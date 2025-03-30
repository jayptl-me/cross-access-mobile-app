import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface SettingItemProps {
  icon: import('@/components/ui/IconSymbol').IconSymbolName;
  title: string;
  onPress: () => void;
  showBorder?: boolean;
}

function SettingItem({ icon, title, onPress, showBorder = true }: SettingItemProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <ThemedView
        style={[styles.settingItem, showBorder && styles.settingItemBorder]}>
        <ThemedView style={styles.settingItemLeft}>
          <IconSymbol name={icon} size={24} color="#2151F5" />
          <ThemedText style={styles.settingItemText}>{title}</ThemedText>
        </ThemedView>
        <IconSymbol name="chevron.right" size={20} color="#8E8E93" />
      </ThemedView>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const handleNetworks = () => {
    // Navigate to network management screen
    Alert.alert(
      'Network Management',
      'Select a network to manage:',
      [
        { text: 'Ethereum Mainnet', onPress: () => console.log('Ethereum Mainnet selected') },
        { text: 'Ethereum Goerli', onPress: () => console.log('Ethereum Goerli selected') },
        { text: 'Polygon Mainnet', onPress: () => console.log('Polygon Mainnet selected') },
        { text: 'Polygon Mumbai', onPress: () => console.log('Polygon Mumbai selected') },
        { text: 'Add Custom Network', onPress: () => handleAddCustomNetwork() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const handleAddCustomNetwork = () => {
    // Show dialog to add custom network
    // Note: Using Alert.alert instead of Alert.prompt for cross-platform compatibility
    Alert.alert(
      'Add Custom Network',
      'To add a custom network, please go to the Networks tab and use the "Add Network" button.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: () => {
            // In a full implementation, this would navigate to a form screen
            console.log('Navigate to add network form');
          }
        },
      ]
    );
  };

  const handleSecurity = () => {
    // Implement security settings
  };

  const handleWalletConnect = () => {
    // Show WalletConnect settings
    Alert.alert(
      'WalletConnect',
      'Manage your WalletConnect sessions',
      [
        { text: 'View Active Sessions', onPress: () => console.log('View sessions') },
        { text: 'Disconnect All', onPress: () => console.log('Disconnect all') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePrivacy = () => {
    // Implement privacy settings
  };

  const handleAbout = () => {
    // Implement about section
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>
        Settings
      </ThemedText>

      <ScrollView style={styles.settingsList}>
        <ThemedView style={styles.settingSection}>
          <SettingItem
            icon="network"
            title="Networks"
            onPress={handleNetworks}
          />
          <SettingItem
            icon="lock.fill"
            title="Security"
            onPress={handleSecurity}
          />
          <SettingItem
            icon="link"
            title="WalletConnect"
            onPress={handleWalletConnect}
          />
          <SettingItem
            icon="hand.raised.fill"
            title="Privacy"
            onPress={handlePrivacy}
          />
          <SettingItem
            icon="info.circle.fill"
            title="About"
            onPress={handleAbout}
            showBorder={false}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 34,
    marginBottom: 24,
  },
  settingsList: {
    flex: 1,
  },
  settingSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    marginLeft: 12,
    fontSize: 17,
  },
});