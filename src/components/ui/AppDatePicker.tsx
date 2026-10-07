import React, { useState } from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius } from '../../theme/spacing';

interface DatePickerProps {
  value: Date;
  mode?: 'date' | 'time';
  onChange: (date: Date) => void;
  style?: any;
}

export function AppDatePicker({ value, mode = 'date', onChange, style }: DatePickerProps) {
  const [show, setShow] = useState(false);

  const onChangePicker = (event: any, selectedDate?: Date) => {
    // Închidem picker-ul pe Android imediat după selecție, pe iOS poate rămâne dacă are mod spinner
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  if (Platform.OS === 'web') {
    return (
      // @ts-ignore
      <input
        type={mode}
        value={
          mode === 'date' 
            ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
            : `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        }
        onChange={(e: any) => {
          if (!e.target.value) return;
          if (mode === 'date') {
            const [y, m, d] = e.target.value.split('-');
            if (y && m && d) {
              const newDate = new Date(value);
              newDate.setFullYear(Number(y), Number(m) - 1, Number(d));
              onChange(newDate);
            }
          } else {
            const [h, m] = e.target.value.split(':');
            if (h && m) {
              const newDate = new Date(value);
              newDate.setHours(Number(h), Number(m));
              onChange(newDate);
            }
          }
        }}
        style={{
          height: 48, borderRadius: 12, border: `1.5px solid ${Colors.border}`, 
          backgroundColor: Colors.backgroundSoft, paddingLeft: 12, paddingRight: 12, 
          fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, width: '100%', 
          boxSizing: 'border-box', marginBottom: 12
        } as any}
      />
    );
  }

  return (
    <>
      <TouchableOpacity 
        style={[styles.input, style]} 
        onPress={() => setShow(true)}
      >
        <Text style={styles.text}>
          {mode === 'date' 
            ? value.toLocaleDateString('ro-RO', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : value.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={onChangePicker}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: BorderRadius.lg, 
    borderWidth: 1.5, 
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, 
    paddingHorizontal: Spacing.md, 
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  text: {
    fontSize: 14, 
    fontFamily: 'Geist', 
    color: Colors.textPrimary,
  }
});
