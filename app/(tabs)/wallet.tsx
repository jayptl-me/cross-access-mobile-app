import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { Network } from 'alchemy-sdk';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import WalletService, { ChainType, TokenBalance as ServiceTokenBalance, CHAIN_NETWORKS } from '@/services/WalletService';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  value: string;
  logoURI?: string;
}

export default function WalletScreen() {
  const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.ETHEREUM);
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(Network.ETH_MAINNET);
  const [portfolio, setPortfolio] = useState<TokenBalance[]>([]);
  const [totalValue, setTotalValue] = useState('0.00');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  
  const walletService = WalletService.getInstance();
  
  // Available chains
  const chains = [
    { name: 'Ethereum', type: ChainType.ETHEREUM },
    { name: 'Polygon', type: ChainType.POLYGON },
    // More chains can be added here
  ];
  
  // Get networks for the selected chain
  const networks = CHAIN_NETWORKS[selectedChain as keyof typeof CHAIN_NETWORKS] || [];
  
  // Initialize wallet service and check if wallet exists
  useEffect(() => {
    const initWallet = async () => {
      try {
        await walletService.initialize();
        const hasWallet = walletService.hasWallet(selectedChain);
        setIsConnected(hasWallet);
        
        if (hasWallet) {
          const address = walletService.getWalletAddress(selectedChain);
          setWalletAddress(address);
          loadPortfolio();
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      }
    };
    
    initWallet();
  }, []);
  
  // Load portfolio when network changes
  useEffect(() => {
    if (isConnected) {
      loadPortfolio();
    }
  }, [selectedNetwork, selectedChain, isConnected]);
  
  const loadPortfolio = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      // Get token balances
      const tokenBalances = await walletService.getTokenBalances(selectedChain, selectedNetwork);
      
      // Get native token balance
      const nativeBalance = await walletService.getBalance(selectedChain, selectedNetwork);
      
      // Format portfolio data
      const portfolioData: TokenBalance[] = tokenBalances.map(token => ({
        symbol: token.token.symbol,
        name: token.token.name,
        balance: token.balance,
        value: token.value,
        logoURI: token.token.logoURI
      }));
      
      // Add native token to portfolio
      let nativeSymbol = 'ETH';
      let nativeName = 'Ethereum';
      
      // Set native token based on selected chain
      if (selectedChain === ChainType.ETHEREUM) {
        nativeSymbol = 'ETH';
        nativeName = 'Ethereum';
      } else if (selectedChain === ChainType.POLYGON) {
        nativeSymbol = 'MATIC';
        nativeName = 'Polygon';
      } else if (selectedChain === ChainType.SOLANA) {
        nativeSymbol = 'SOL';
        nativeName = 'Solana';
      } else if (selectedChain === ChainType.BINANCE) {
        nativeSymbol = 'BNB';
        nativeName = 'Binance';
      }
      
      portfolioData.unshift({
        symbol: nativeSymbol,
        name: nativeName,
        balance: nativeBalance,
        value: '0.00', // Would need price data to calculate value
      });
      
      setPortfolio(portfolioData);
      
      // Calculate total value (would need price data for accurate calculation)
      const total = portfolioData.reduce((sum, token) => {
        return sum + parseFloat(token.value || '0');
      }, 0);
      
      setTotalValue(total.toFixed(2));
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      Alert.alert('Error', 'Failed to load portfolio. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const connectWallet = async () => {
    try {
      setIsLoading(true);
      // Create a new wallet if one doesn't exist
      const address = await walletService.createWallet(selectedChain);
      setWalletAddress(address);
      setIsConnected(true);
      loadPortfolio();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      Alert.alert('Error', 'Failed to connect wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress(null);
    setPortfolio([]);
    setTotalValue('0.00');
  };
  
  const switchChain = (chainType: ChainType) => {
    setSelectedChain(chainType);
    // Set default network for the selected chain
    const chainNetworks = CHAIN_NETWORKS[chainType as keyof typeof CHAIN_NETWORKS];
    if (chainNetworks && chainNetworks.length > 0) {
      setSelectedNetwork(chainNetworks[0].network);
    }
    
    // Check if wallet exists for this chain
    const hasWallet = walletService.hasWallet(chainType);
    setIsConnected(hasWallet);
    
    if (hasWallet) {
      const address = walletService.getWalletAddress(chainType);
      setWalletAddress(address);
      loadPortfolio();
    } else {
      setWalletAddress(null);
      setPortfolio([]);
      setTotalValue('0.00');
    }
  };
  
  const switchNetwork = (network: Network) => {
    setSelectedNetwork(network);
    // Portfolio will be refreshed by the useEffect hook
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.totalValue}>
          ${totalValue}
        </ThemedText>
        {walletAddress && isConnected && (
          <ThemedText style={styles.walletAddress}>
            {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
          </ThemedText>
        )}
        <TouchableOpacity
          style={[styles.connectButton, isConnected && styles.disconnectButton]}
          onPress={isConnected ? disconnectWallet : connectWallet}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.buttonText}>
              {isConnected ? 'Disconnect' : 'Connect Wallet'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ThemedView>

      {/* Chain Selector */}
      <ThemedView style={styles.selectorContainer}>
        <ThemedText style={styles.selectorLabel}>Chain</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {chains.map((chain) => (
            <TouchableOpacity
              key={chain.name}
              style={[
                styles.chainButton,
                selectedChain === chain.type && styles.selectedChain,
              ]}
              onPress={() => switchChain(chain.type)}>
              <ThemedText
                style={[
                  styles.chainText,
                  selectedChain === chain.type && styles.selectedChainText,
                ]}>
                {chain.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedView>

      {/* Network Selector */}
      <ThemedView style={styles.selectorContainer}>
        <ThemedText style={styles.selectorLabel}>Network</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {networks.map((net: { name: string; network: Network }) => (
            <TouchableOpacity
              key={net.name}
              style={[
                styles.networkButton,
                selectedNetwork === net.network && styles.selectedNetwork,
              ]}
              onPress={() => switchNetwork(net.network)}>
              <ThemedText
                style={[
                  styles.networkText,
                  selectedNetwork === net.network && styles.selectedNetworkText,
                ]}>
                {net.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedView>

      {/* Portfolio List */}
      <ThemedText style={styles.portfolioHeader}>Portfolio</ThemedText>
      {isLoading ? (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2151F5" />
        </ThemedView>
      ) : (
        <ScrollView style={styles.portfolioList}>
          {portfolio.length > 0 ? (
            portfolio.map((token, index) => (
              <ThemedView key={index} style={styles.tokenItem}>
                <ThemedView style={styles.tokenInfo}>
                  {token.logoURI ? (
                    <Image source={{ uri: token.logoURI }} style={styles.tokenLogo} />
                  ) : (
                    <ThemedView style={styles.tokenLogoPlaceholder}>
                      <ThemedText>{token.symbol.substring(0, 1)}</ThemedText>
                    </ThemedView>
                  )}
                  <ThemedView>
                    <ThemedText type="defaultSemiBold">{token.symbol}</ThemedText>
                    <ThemedText style={styles.tokenName}>{token.name}</ThemedText>
                  </ThemedView>
                </ThemedView>
                <ThemedView style={styles.tokenValues}>
                  <ThemedText>{parseFloat(token.balance).toFixed(4)}</ThemedText>
                  <ThemedText type="defaultSemiBold">${token.value}</ThemedText>
                </ThemedView>
              </ThemedView>
            ))
          ) : isConnected ? (
            <ThemedView style={styles.emptyState}>
              <IconSymbol name="creditcard.fill" size={48} color="#E5E5E5" />
              <ThemedText style={styles.emptyStateText}>No tokens found</ThemedText>
              <TouchableOpacity style={styles.refreshButton} onPress={loadPortfolio}>
                <ThemedText style={styles.refreshButtonText}>Refresh</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.emptyState}>
              <IconSymbol name="creditcard.fill" size={48} color="#E5E5E5" />
              <ThemedText style={styles.emptyStateText}>Connect your wallet to view your portfolio</ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  totalValue: {
    fontSize: 36,
    marginBottom: 8,
  },
  walletAddress: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#2151F5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#687076',
  },
  chainButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  selectedChain: {
    backgroundColor: '#2151F5',
  },
  chainText: {
    color: '#000000',
  },
  selectedChainText: {
    color: '#FFFFFF',
  },
  networkButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  selectedNetwork: {
    backgroundColor: '#2151F5',
  },
  networkText: {
    color: '#000000',
  },
  selectedNetworkText: {
    color: '#FFFFFF',
  },
  portfolioHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  portfolioList: {
    flex: 1,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  tokenLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tokenName: {
    fontSize: 12,
    color: '#687076',
  },
  tokenValues: {
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#687076',
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2151F5',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});