import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logo from './Logo';
import { colors } from '../constants/designSystem';
import { useAppTheme } from '../src/contexts/ThemeContext';

const CustomSpinner = () => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderLines = () => {
    const lines = [];
    for (let i = 0; i < 12; i++) {
      lines.push(
        <View
          key={i}
          style={[
            styles.spinnerLine,
            {
              transform: [
                { rotate: `${i * 30}deg` },
                { translateY: -35 },
              ],
            },
          ]}
        />
      );
    }
    return lines;
  };

  return (
    <Animated.View style={[styles.spinnerContainer, { transform: [{ rotate: spin }] }]}>
      {renderLines()}
    </Animated.View>
  );
};


export default function GoogleLoginModal({ visible, status }) {
  const { colors: themeColors } = useAppTheme();
  if (!visible) return null;

  return (
    <Modal transparent={false} animationType="fade" visible={visible}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>

        {}
        {status === 'loading' && (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
                {}
                <Image
                  source={require('../app/assets/images/google-ico.png')}
                  style={styles.googleLogo}
                />
                <CustomSpinner />
            </View>
          </View>
        )}

        {}
        {status === 'success' && (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
                <View style={styles.logoRow}>
                    <Logo variant="dark" size="lg" />
                </View>
                <Text style={[styles.successText, { color: themeColors.textPrimary }]}>Has ingresado con éxito</Text>
                <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={50} color="white" />
                </View>
            </View>
          </View>
        )}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
    alignItems: 'center',
  },
  headerText: {
    position: 'absolute',
    top: 60,
    left: 30,
    color: '#888',
    fontSize: 16,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleLogo: {
    width: 100,
    height: 100,
    marginBottom: 100,
    resizeMode: 'contain',
  },
  spinnerContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerLine: {
    position: 'absolute',
    width: 6,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  logoRow: {
    marginBottom: 30,
  },
  successText: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: 40,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: colors.primaryLight,
  }
});
