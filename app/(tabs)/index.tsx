import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { SignClient } from '@walletconnect/sign-client';
import { Web3Wallet } from '@walletconnect/web3wallet';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import WalletService, { ChainType, CHAIN_NETWORKS } from '@/services/WalletService';
import { ICore } from '@walletconnect/types';

const DEFAULT_URL = 'https://app.uniswap.org';
const PROJECT_ID = 'YOUR_PROJECT_ID'; // Replace with your WalletConnect project ID

export default function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [walletClient, setWalletClient] = useState<any>(null); // Using any for Web3Wallet instance
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [connectedDapp, setConnectedDapp] = useState<string | null>(null);
  
  const walletService = WalletService.getInstance();

  // Initialize wallet service and WalletConnect client
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Initialize wallet service
        await walletService.initialize();
        
        // Initialize WalletConnect
        const signClient = await SignClient.init({
          projectId: PROJECT_ID,
          metadata: {
            name: 'Cross Access Browser',
            description: 'Web3 Browser with Integrated Wallet',
            url: 'https://crossaccess.app',
            icons: ['https://crossaccess.app/icon.png']
          }
        });

        const web3wallet = await Web3Wallet.init({
          core: signClient as unknown as ICore,
          metadata: {
            name: 'Cross Access Wallet',
            description: 'Web3 Wallet',
            url: 'https://crossaccess.app',
            icons: ['https://crossaccess.app/icon.png']
          }
        });

        setWalletClient(web3wallet);
        setIsWalletInitialized(true);
        
        // Setup event listeners for WalletConnect
        web3wallet.on('session_proposal', handleSessionProposal);
        web3wallet.on('session_request', handleSessionRequest);
      } catch (error) {
        console.error('Failed to initialize:', error);
        Alert.alert('Initialization Error', 'Failed to initialize wallet services.');
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
    
    // Cleanup function
    return () => {
      if (walletClient) {
        walletClient.off('session_proposal', handleSessionProposal);
        walletClient.off('session_request', handleSessionRequest);
      }
    };
  }, []);

  // Handle WalletConnect session proposals
  const handleSessionProposal = useCallback(async (proposal: any) => {
    try {
      setIsConnecting(true);
      
      // Check if we have a wallet for Ethereum
      if (!walletService.hasWallet(ChainType.ETHEREUM)) {
        Alert.alert(
          'Wallet Required', 
          'You need to create or import a wallet before connecting to dApps.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Wallet', 
              onPress: async () => {
                try {
                  await walletService.createWallet(ChainType.ETHEREUM);
                  // Try to approve the session again
                  handleSessionProposal(proposal);
                } catch (error) {
                  console.error('Failed to create wallet:', error);
                  Alert.alert('Error', 'Failed to create wallet');
                }
              } 
            }
          ]
        );
        setIsConnecting(false);
        return;
      }
      
      // Get wallet address
      const address = walletService.getWalletAddress(ChainType.ETHEREUM);
      if (!address) {
        Alert.alert('Error', 'Wallet address not found');
        setIsConnecting(false);
        return;
      }
      
      // Approve the session
      const { id, params } = proposal;
      const { proposer, requiredNamespaces } = params;
      
      // Store the connected dApp name
      setConnectedDapp(proposer.metadata.name);
      
      // Approve the session with the wallet address
      const namespaces: any = {};
      Object.keys(requiredNamespaces).forEach(key => {
        const namespace = requiredNamespaces[key];
        namespaces[key] = {
          accounts: [`eip155:1:${address}`], // Ethereum mainnet
          methods: namespace.methods,
          events: namespace.events
        };
      });
      
      await walletClient?.approveSession({
        id,
        namespaces
      });
      
      Alert.alert('Connected', `Connected to ${proposer.metadata.name}`);
    } catch (error) {
      console.error('Failed to approve session:', error);
      Alert.alert('Connection Error', 'Failed to connect to dApp');
    } finally {
      setIsConnecting(false);
    }
  }, [walletClient, walletService]);
  
  // Handle WalletConnect session requests (transactions, signing, etc.)
  const handleSessionRequest = useCallback(async (requestEvent: any) => {
    try {
      const { id, topic, params } = requestEvent;
      const { request } = params;
      const { method, params: methodParams } = request;
      
      // Handle different request methods
      switch (method) {
        case 'eth_sendTransaction':
          // Show transaction confirmation UI
          Alert.alert(
            'Transaction Request',
            `Do you want to send this transaction?\n\nTo: ${methodParams[0].to}\nValue: ${methodParams[0].value}`,
            [
              { text: 'Reject', style: 'cancel', onPress: () => walletClient?.rejectSession({ id, reason: { code: 4001, message: 'User rejected' } }) },
              { 
                text: 'Approve', 
                onPress: async () => {
                  try {
                    // Send transaction using wallet service
                    const tx = await walletService.sendTransaction(
                      ChainType.ETHEREUM,
                      CHAIN_NETWORKS[ChainType.ETHEREUM][0].network,
                      methodParams[0].to,
                      methodParams[0].value
                    );
                    
                    // Respond with transaction hash
                    await walletClient?.respondSessionRequest({
                      topic,
                      response: {
                        id,
                        jsonrpc: '2.0',
                        result: tx.hash
                      }
                    });
                  } catch (error) {
                    console.error('Transaction failed:', error);
                    walletClient?.rejectSession({ id, reason: { code: 4001, message: 'Transaction failed' } });
                  }
                }
              }
            ]
          );
          break;
          
        case 'eth_sign':
        case 'personal_sign':
          // Show signing confirmation UI
          Alert.alert(
            'Signature Request',
            'Do you want to sign this message?',
            [
              { text: 'Reject', style: 'cancel', onPress: () => walletClient?.rejectSession({ id, reason: { code: 4001, message: 'User rejected' } }) },
              { 
                text: 'Sign', 
                onPress: async () => {
                  try {
                    // Sign message using wallet service
                    const signature = await walletService.signMessage(ChainType.ETHEREUM, methodParams[0]);
                    
                    // Respond with signature
                    await walletClient?.respondSessionRequest({
                      topic,
                      response: {
                        id,
                        jsonrpc: '2.0',
                        result: signature
                      }
                    });
                  } catch (error) {
                    console.error('Signing failed:', error);
                    walletClient?.rejectSession({ id, reason: { code: 4001, message: 'Signing failed' } });
                  }
                }
              }
            ]
          );
          break;
          
        default:
          // Reject unsupported methods
          walletClient?.rejectSession({ id, reason: { code: 4001, message: 'Method not supported' } });
      }
    } catch (error) {
      console.error('Failed to handle session request:', error);
    }
  }, [walletClient, walletService]);
  
  // Handle incoming WalletConnect URI from WebView
  const handleWalletConnectRequest = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle WalletConnect URI
      if (data.uri && data.uri.startsWith('wc:')) {
        if (walletClient && isWalletInitialized) {
          await walletClient.pair({ uri: data.uri });
        } else {
          Alert.alert('Error', 'Wallet not initialized');
        }
        return;
      }
      
      // Handle Ethereum provider requests
      if (data.method) {
        handleEthereumRequest(data);
      }
    } catch (error) {
      console.error('Failed to handle WebView message:', error);
    }
  }, [walletClient, isWalletInitialized]);
  
  // Handle Ethereum provider requests from WebView
  const handleEthereumRequest = useCallback(async (data: any) => {
    const { method, params } = data;
    
    switch (method) {
      case 'eth_requestAccounts':
        // Check if we have a wallet
        if (!walletService.hasWallet(ChainType.ETHEREUM)) {
          Alert.alert(
            'Wallet Required', 
            'You need to create or import a wallet before connecting.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Create Wallet', 
                onPress: async () => {
                  try {
                    const address = await walletService.createWallet(ChainType.ETHEREUM);
                    // Return the address to the dApp
                    const response = {
                      id: data.id,
                      jsonrpc: '2.0',
                      result: [address]
                    };
                    webViewRef.current?.injectJavaScript(`
                      window.ethereum.sendResponse(${JSON.stringify(response)});
                    `);
                  } catch (error) {
                    console.error('Failed to create wallet:', error);
                    Alert.alert('Error', 'Failed to create wallet');
                  }
                } 
              }
            ]
          );
          return;
        }
        
        // Return wallet address
        const address = walletService.getWalletAddress(ChainType.ETHEREUM);
        if (address) {
          const response = {
            id: data.id,
            jsonrpc: '2.0',
            result: [address]
          };
          webViewRef.current?.injectJavaScript(`
            window.ethereum.sendResponse(${JSON.stringify(response)});
          `);
        }
        break;
        
      // Add more Ethereum methods as needed
      
      default:
        // Return error for unsupported methods
        const errorResponse = {
          id: data.id,
          jsonrpc: '2.0',
          error: { code: 4200, message: 'Method not supported' }
        };
        webViewRef.current?.injectJavaScript(`
          window.ethereum.sendResponse(${JSON.stringify(errorResponse)});
        `);
    }
  }, [walletService]);

  // Navigate to a URL
  const navigateTo = useCallback((url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setInputUrl(url);
    setCurrentUrl(url);
    webViewRef.current?.injectJavaScript(`window.location.href = "${url}";`);
  }, []);
  
  // Handle URL submission
  const handleUrlSubmit = useCallback(() => {
    navigateTo(inputUrl);
  }, [inputUrl, navigateTo]);
  
  // Disconnect from dApp
  const disconnectFromDapp = useCallback(async () => {
    if (walletClient) {
      try {
        // Get all active sessions
        const sessions = walletClient.getActiveSessions();
        
        // Disconnect all sessions
        for (const [topic, session] of Object.entries(sessions)) {
          await walletClient.disconnectSession({
            topic,
            reason: { code: 6000, message: 'User disconnected' }
          });
        }
        
        setConnectedDapp(null);
        Alert.alert('Disconnected', 'Disconnected from all dApps');
      } catch (error) {
        console.error('Failed to disconnect:', error);
        Alert.alert('Error', 'Failed to disconnect from dApp');
      }
    }
  }, [walletClient]);
  
  // Inject WalletConnect bridge into WebView
  const injectWalletConnect = `
    window.ethereum = {
      isMetaMask: true,
      chainId: '0x1', // Ethereum mainnet
      networkVersion: '1',
      selectedAddress: null,
      isConnected: () => true,
      sendResponse: function(response) {
        const callback = this._callbacks[response.id];
        if (callback) {
          callback.resolve(response.result);
          delete this._callbacks[response.id];
        }
      },
      _callbacks: {},
      _nextId: 1,
      request: async function({ method, params }) {
        const id = this._nextId++;
        const promise = new Promise((resolve, reject) => {
          this._callbacks[id] = { resolve, reject };
        });
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id,
          method,
          params
        }));
        
        return promise;
      }
    };
    
    // Detect WalletConnect URIs
    document.addEventListener('click', function(e) {
      const element = e.target;
      if (element.tagName === 'A' && element.href && element.href.startsWith('wc:')) {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({ uri: element.href }));
      }
    });
  `;

  return (
    <ThemedView style={styles.container}>
      {/* Browser header */}
      <ThemedView style={styles.header}>
        <View style={styles.urlBar}>
          <TextInput
            style={styles.urlInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={handleUrlSubmit}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={styles.goButton} onPress={handleUrlSubmit}>
            <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ThemedView>
      
      {/* Connection status */}
      {connectedDapp && (
        <ThemedView style={styles.connectionStatus}>
          <ThemedText style={styles.connectionText}>
            Connected to: {connectedDapp}
          </ThemedText>
          <TouchableOpacity style={styles.disconnectButton} onPress={disconnectFromDapp}>
            <ThemedText style={styles.disconnectText}>Disconnect</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <ThemedView style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2151F5" />
        </ThemedView>
      )}
      
      {/* Connection indicator */}
      {isConnecting && (
        <ThemedView style={styles.loadingOverlay}>
          <ThemedView style={styles.connectingCard}>
            <ActivityIndicator size="small" color="#2151F5" />
            <ThemedText style={styles.connectingText}>Connecting to dApp...</ThemedText>
          </ThemedView>
        </ThemedView>
      )}
      
      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webview}
        injectedJavaScript={injectWalletConnect}
        onMessage={handleWalletConnectRequest}
        onNavigationStateChange={(navState) => {
          setCurrentUrl(navState.url);
          setInputUrl(navState.url);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urlInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 8,
    fontSize: 16,
  },
  goButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2151F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  connectingCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectingText: {
    marginLeft: 12,
    fontSize: 16,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#F0F8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  connectionText: {
    fontSize: 14,
    color: '#2151F5',
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
  },
  disconnectText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
