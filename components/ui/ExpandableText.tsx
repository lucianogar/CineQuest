import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableTextProps {
  text: string;
  numberOfLines?: number;
  style?: any;
  colors: any;
}

export const ExpandableText = ({ text, numberOfLines = 6, style, colors }: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [numLines, setNumLines] = useState<number | undefined>(numberOfLines);

  const onTextLayout = useCallback((e: any) => {
    // Se o número real de linhas for maior que o limite, mostramos o botão
    if (e.nativeEvent.lines.length > numberOfLines && !showMore) {
      setShowMore(true);
    }
  }, [numberOfLines, showMore]);

  const toggleExpand = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(!expanded);
  };

  if (!text) return null;

  return (
    <View style={styles.container}>
      {/* Texto invisível para medição exata do número de linhas sem o limite de corte */}
      {!showMore && (
        <Text
          style={[styles.text, style, { position: 'absolute', opacity: 0 }]}
          onTextLayout={onTextLayout}
        >
          {text}
        </Text>
      )}

      <Text
        style={[styles.text, style]}
        numberOfLines={expanded ? 9999 : numberOfLines}
      >
        {text}
      </Text>
      
      {showMore && (
        <TouchableOpacity onPress={toggleExpand} style={styles.button} activeOpacity={0.7}>
          <Text style={[styles.buttonText, { color: colors.tint }]}>
            {expanded ? 'Ler menos' : 'Ler mais...'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 5,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
    textAlign: 'justify',
  },
  button: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ExpandableText;
