import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'error' | 'info';
  onHide?: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onHide,
  duration = 2000,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          if (onHide) onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!message) return null;

  const getBgColor = () => {
    if (type === 'error') return '#e11d48';
    if (type === 'info') return '#0284c7';
    return '#10b981'; // success
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        { backgroundColor: getBgColor(), opacity: fadeAnim },
      ]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
});
