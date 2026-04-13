import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export const haptics = {
  impact: async () => {
    if (isNative) {
      // In a real build, we'd use @capacitor/haptics
      console.log('Haptic impact triggered');
    }
  }
};

export const notifications = {
  schedule: async (title: string, body: string) => {
    if (isNative) {
      // In a real build, we'd use @capacitor/local-notifications
      console.log('Notification scheduled:', title, body);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch (error) {
        console.error('Failed to display notification:', error);
      }
    }
  }
};
