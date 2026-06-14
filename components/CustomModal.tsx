import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react-native';

interface ModalButton {
  text: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
}

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  buttons?: ModalButton[];
  onClose: () => void;
}

export default function CustomModal({ visible, title, message, type = 'info', buttons, onClose }: CustomModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];

  const defaultButtons: ModalButton[] = [
    { text: 'Entendi', onPress: onClose, primary: true }
  ];

  const finalButtons = buttons && buttons.length > 0 ? buttons : defaultButtons;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 size={40} color="#10B981" />;
      case 'error': return <XCircle size={40} color="#EF4444" />;
      case 'warning': return <AlertCircle size={40} color="#F59E0B" />;
      default: return <Info size={40} color={colors.tint} />;
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.icon }]}>{message}</Text>
          
          <View style={[styles.buttonContainer, { flexDirection: finalButtons.length > 2 ? 'column' : 'row' }]}>
            {finalButtons.map((btn, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  btn.primary ? { backgroundColor: colors.tint } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
                  btn.destructive ? { backgroundColor: '#EF4444', borderColor: '#EF4444' } : null,
                  { 
                    flex: finalButtons.length > 2 ? undefined : 1, 
                    width: finalButtons.length > 2 ? '100%' : 'auto',
                    minWidth: finalButtons.length === 1 ? 120 : 0 
                  }
                ]}
                onPress={() => {
                  btn.onPress();
                  onClose();
                }}
              >
                <Text 
                  style={[styles.buttonText, { color: btn.primary || btn.destructive ? '#FFF' : colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 25,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});
