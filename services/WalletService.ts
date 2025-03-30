import { ethers } from 'ethers';
import { Alchemy, Network } from 'alchemy-sdk';
import { formatEther } from '@ethersproject/units';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define supported chains
export enum ChainType {
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  SOLANA = 'solana',
  BINANCE = 'binance',
}

// Map chain types to networks
export const CHAIN_NETWORKS = {
  [ChainType.ETHEREUM]: [
    { name: 'Ethereum', network: Network.ETH_MAINNET },
    { name: 'Goerli', network: Network.ETH_GOERLI },
  ],
  [ChainType.POLYGON]: [
    { name: 'Polygon', network: Network.MATIC_MAINNET },
    { name: 'Mumbai', network: Network.MATIC_MUMBAI },
  ],
  // Add other chains as needed
};

// Token interface
export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  chainType: ChainType;
  logoURI?: string;
}

// Token balance interface
export interface TokenBalance {
  token: Token;
  balance: string;
  value: string;
}

// Transaction interface
export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  chainType: ChainType;
  network: Network;
}

class WalletService {
  private static instance: WalletService;
  private wallets: Record<ChainType, ethers.Wallet | null> = {
    [ChainType.ETHEREUM]: null,
    [ChainType.POLYGON]: null,
    [ChainType.SOLANA]: null,
    [ChainType.BINANCE]: null,
  };
  private providers: Record<string, ethers.providers.Provider> = {};
  private alchemyInstances: Record<string, Alchemy> = {};
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }
  
  // Initialize wallet service
  public async initialize(): Promise<void> {
    await this.loadWallets();
    this.setupProviders();
  }
  
  // Create a new wallet for a specific chain
  public async createWallet(chainType: ChainType): Promise<string> {
    const wallet = ethers.Wallet.createRandom();
    this.wallets[chainType] = wallet;
    await this.saveWallet(chainType, wallet.privateKey);
    return wallet.address;
  }
  
  // Import wallet using private key
  public async importWallet(chainType: ChainType, privateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      this.wallets[chainType] = wallet;
      await this.saveWallet(chainType, privateKey);
      return wallet.address;
    } catch (error) {
      console.error('Failed to import wallet:', error);
      throw new Error('Invalid private key');
    }
  }
  
  // Import wallet using mnemonic
  public async importWalletFromMnemonic(chainType: ChainType, mnemonic: string): Promise<string> {
    try {
      const wallet = ethers.Wallet.fromMnemonic(mnemonic);
      this.wallets[chainType] = wallet;
      await this.saveWallet(chainType, wallet.privateKey);
      return wallet.address;
    } catch (error) {
      console.error('Failed to import wallet from mnemonic:', error);
      throw new Error('Invalid mnemonic phrase');
    }
  }
  
  // Get wallet address for a specific chain
  public getWalletAddress(chainType: ChainType): string | null {
    return this.wallets[chainType]?.address || null;
  }
  
  // Check if wallet exists for a specific chain
  public hasWallet(chainType: ChainType): boolean {
    return this.wallets[chainType] !== null;
  }
  
  // Get balance for a specific chain and network
  public async getBalance(chainType: ChainType, network: Network): Promise<string> {
    const wallet = this.wallets[chainType];
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const provider = this.getProvider(chainType, network);
    const balance = await provider.getBalance(wallet.address);
    return formatEther(balance);
  }
  
  // Get token balances for a specific chain and network
  public async getTokenBalances(chainType: ChainType, network: Network): Promise<TokenBalance[]> {
    const wallet = this.wallets[chainType];
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    // For Ethereum and Polygon, we can use Alchemy
    if (chainType === ChainType.ETHEREUM || chainType === ChainType.POLYGON) {
      const alchemy = this.getAlchemyInstance(chainType, network);
      const tokenBalances = await alchemy.core.getTokenBalances(wallet.address);
      
      // Process token balances
      const balances: TokenBalance[] = [];
      for (const tokenBalance of tokenBalances.tokenBalances) {
        if (tokenBalance.tokenBalance) {
          const metadata = await alchemy.core.getTokenMetadata(tokenBalance.contractAddress);
          balances.push({
            token: {
              symbol: metadata.symbol || 'Unknown',
              name: metadata.name || 'Unknown Token',
              decimals: metadata.decimals || 18,
              address: tokenBalance.contractAddress,
              chainType,
              logoURI: metadata.logo,
            },
            balance: formatEther(tokenBalance.tokenBalance),
            value: '0.00', // Would need price data to calculate value
          });
        }
      }
      return balances;
    }
    
    // For other chains, implement specific logic
    return [];
  }
  
  // Send transaction
  public async sendTransaction(
    chainType: ChainType, 
    network: Network, 
    to: string, 
    amount: string
  ): Promise<Transaction> {
    const wallet = this.wallets[chainType];
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const provider = this.getProvider(chainType, network);
    const connectedWallet = wallet.connect(provider);
    
    const tx = await connectedWallet.sendTransaction({
      to,
      value: ethers.utils.parseEther(amount),
    });
    
    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      value: amount,
      timestamp: Date.now(),
      status: 'pending',
      chainType,
      network,
    };
  }
  
  // Sign message
  public async signMessage(chainType: ChainType, message: string): Promise<string> {
    const wallet = this.wallets[chainType];
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    return wallet.signMessage(message);
  }
  
  // Get transaction history
  public async getTransactionHistory(chainType: ChainType, network: Network): Promise<Transaction[]> {
    const wallet = this.wallets[chainType];
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    if (chainType === ChainType.ETHEREUM || chainType === ChainType.POLYGON) {
      const alchemy = this.getAlchemyInstance(chainType, network);
      const history = await alchemy.core.getAssetTransfers({
        fromAddress: wallet.address,
        category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      });
      
      return history.transfers.map(transfer => ({
        hash: transfer.hash,
        from: transfer.from,
        to: transfer.to,
        value: transfer.value ? transfer.value.toString() : '0',
        timestamp: transfer.metadata.blockTimestamp ? new Date(transfer.metadata.blockTimestamp).getTime() : Date.now(),
        status: 'confirmed',
        chainType,
        network,
      }));
    }
    
    // For other chains, implement specific logic
    return [];
  }
  
  // Private methods
  private async loadWallets(): Promise<void> {
    try {
      for (const chainType of Object.values(ChainType)) {
        const privateKey = await AsyncStorage.getItem(`wallet_${chainType}`);
        if (privateKey) {
          this.wallets[chainType] = new ethers.Wallet(privateKey);
        }
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
    }
  }
  
  private async saveWallet(chainType: ChainType, privateKey: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`wallet_${chainType}`, privateKey);
    } catch (error) {
      console.error('Failed to save wallet:', error);
    }
  }
  
  private setupProviders(): void {
    // Setup Ethereum providers
    this.providers[`${ChainType.ETHEREUM}_${Network.ETH_MAINNET}`] = ethers.getDefaultProvider('mainnet');
    this.providers[`${ChainType.ETHEREUM}_${Network.ETH_GOERLI}`] = ethers.getDefaultProvider('goerli');
    
    // Setup Polygon providers
    this.providers[`${ChainType.POLYGON}_${Network.MATIC_MAINNET}`] = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    this.providers[`${ChainType.POLYGON}_${Network.MATIC_MUMBAI}`] = new ethers.providers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com');
    
    // Setup Alchemy instances
    this.alchemyInstances[`${ChainType.ETHEREUM}_${Network.ETH_MAINNET}`] = new Alchemy({
      apiKey: 'YOUR_ALCHEMY_API_KEY', // Replace with your Alchemy API key
      network: Network.ETH_MAINNET,
    });
    
    this.alchemyInstances[`${ChainType.ETHEREUM}_${Network.ETH_GOERLI}`] = new Alchemy({
      apiKey: 'YOUR_ALCHEMY_API_KEY', // Replace with your Alchemy API key
      network: Network.ETH_GOERLI,
    });
    
    this.alchemyInstances[`${ChainType.POLYGON}_${Network.MATIC_MAINNET}`] = new Alchemy({
      apiKey: 'YOUR_ALCHEMY_API_KEY', // Replace with your Alchemy API key
      network: Network.MATIC_MAINNET,
    });
    
    this.alchemyInstances[`${ChainType.POLYGON}_${Network.MATIC_MUMBAI}`] = new Alchemy({
      apiKey: 'YOUR_ALCHEMY_API_KEY', // Replace with your Alchemy API key
      network: Network.MATIC_MUMBAI,
    });
  }
  
  private getProvider(chainType: ChainType, network: Network): ethers.providers.Provider {
    const key = `${chainType}_${network}`;
    if (!this.providers[key]) {
      throw new Error(`Provider not found for ${chainType} ${network}`);
    }
    return this.providers[key];
  }
  
  private getAlchemyInstance(chainType: ChainType, network: Network): Alchemy {
    const key = `${chainType}_${network}`;
    if (!this.alchemyInstances[key]) {
      throw new Error(`Alchemy instance not found for ${chainType} ${network}`);
    }
    return this.alchemyInstances[key];
  }
}

export default WalletService;