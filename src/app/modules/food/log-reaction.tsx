import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { useFoodStore } from '../../../stores/foodStore';
import { foodService } from '../../../services/foodService';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import Toast from 'react-native-toast-message';

export default function LogReactionScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const { introducedFoods, addReaction, updateIntroducedFood } = useFoodStore();

  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | null>(null);
  const [contactedDoctor, setContactedDoctor] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const symptomsList = [
    { id: 'rash', ro: 'Erupție / bubițe', en: 'Rash / bumps' },
    { id: 'mouth_redness', ro: 'Roșeață în jurul gurii', en: 'Redness around mouth' },
    { id: 'vomiting', ro: 'Vărsături', en: 'Vomiting' },
    { id: 'diarrhea', ro: 'Diaree', en: 'Diarrhea' },
    { id: 'constipation', ro: 'Constipație', en: 'Constipation' },
    { id: 'bloating', ro: 'Balonare', en: 'Bloating' },
    { id: 'fussiness', ro: 'Agitație', en: 'Fussiness' },
    { id: 'cough', ro: 'Tuse', en: 'Cough' },
    { id: 'swelling', ro: 'Umflare buze/ochi', en: 'Swollen lips/eyes' },
    { id: 'breathing', ro: 'Respirație dificilă', en: 'Difficulty breathing' },
    { id: 'other', ro: 'Altceva', en: 'Other' },
  ];

  const selectedFood = introducedFoods.find(f => f.id === selectedFoodId);

  const toggleSymptom = (s: string) => {
    if (selectedSymptoms.includes(s)) setSelectedSymptoms(prev => prev.filter(i => i !== s));
    else setSelectedSymptoms(prev => [...prev, s]);
  };

  const handleSave = async () => {
    if (!user || !activeChild || !selectedFood || selectedSymptoms.length === 0 || !severity) {
      Toast.show({ type: 'error', text1: isEnglish ? 'Complete the required fields' : 'Completează câmpurile obligatorii' });
      return;
    }
    
    setIsSaving(true);
    try {
      const newReaction: any = {
        childId: activeChild.id,
        userId: user.uid,
        suspectedFoodId: selectedFood.id,
        suspectedFoodName: selectedFood.name,
        reactionAt: new Date().toISOString(),
        symptoms: selectedSymptoms,
        severity,
        photos: [], // placeholders pt MVP
        contactedDoctor,
        notes,
      };

      const id = await foodService.addReaction(user.uid, activeChild.id, newReaction);
      addReaction({ ...newReaction, id });
      
      // Update the food record to reflect the reaction
      await foodService.updateIntroducedFood(user.uid, activeChild.id, selectedFood.id, { reactionStatus: severity });
      updateIntroducedFood(selectedFood.id, { reactionStatus: severity });

      Toast.show({
        type: 'success',
        text1: isEnglish ? 'Reaction logged.' : 'Reacție notată.',
        text2: isEnglish ? 'Talk to your doctor if you are worried.' : 'Discută cu medicul dacă te îngrijorează.',
      });
      router.back();
    } catch (e) {
      console.warn('Eroare adăugare reacție', e);
      Toast.show({ type: 'error', text1: isEnglish ? 'Something went wrong' : 'A apărut o eroare' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Log reaction' : 'Notează reacție'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        
        {/* MEDICAL ALERT */}
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{isEnglish ? 'Medical emergency' : 'Urgență medicală'}</Text>
          <Text style={styles.alertText}>
            {isEnglish
              ? 'If breathing problems, swelling of the face/lips, severe sleepiness or a rapid intense reaction appear, request emergency medical help (112).'
              : 'Dacă apar dificultăți de respirație, umflarea feței/buzelor, stare de somnolență severă sau reacție rapidă intensă, solicită ajutor medical de urgență (112).'}
          </Text>
        </View>

        <Text style={styles.label}>{isEnglish ? 'Suspected food' : 'Aliment suspect'}</Text>
        <TouchableOpacity style={styles.foodSelector} onPress={() => setShowSearchModal(true)}>
          {selectedFood ? (
            <Text style={styles.selectedFoodText}>{selectedFood.name}</Text>
          ) : (
            <Text style={styles.placeholderText}>{isEnglish ? 'Which food do you think caused the reaction?' : 'Ce aliment crezi că a provocat reacția?'}</Text>
          )}
          <Text style={styles.selectorIcon}>▾</Text>
        </TouchableOpacity>

        <Text style={styles.label}>{isEnglish ? 'What symptoms appeared?' : 'Ce simptome au apărut?'}</Text>
        <View style={styles.chipsRow}>
          {symptomsList.map(s => (
            <TouchableOpacity 
              key={s.id} 
              style={[styles.chip, selectedSymptoms.includes(s.id) && styles.chipActive]}
              onPress={() => toggleSymptom(s.id)}
            >
              <Text style={[styles.chipText, selectedSymptoms.includes(s.id) && styles.chipTextActive]}>{isEnglish ? s.en : s.ro}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{isEnglish ? 'Reaction severity' : 'Severitatea reacției'}</Text>
        <View style={styles.severityRow}>
          <TouchableOpacity 
            style={[styles.severityBtn, severity === 'mild' && { backgroundColor: Colors.warning + '20', borderColor: Colors.warning }]}
            onPress={() => setSeverity('mild')}
          >
            <Text style={[styles.severityText, severity === 'mild' && { color: Colors.warning, fontFamily: 'Geist-Bold' }]}>{isEnglish ? 'Mild' : 'Ușoară'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.severityBtn, severity === 'moderate' && { backgroundColor: Colors.error + '20', borderColor: Colors.error }]}
            onPress={() => setSeverity('moderate')}
          >
            <Text style={[styles.severityText, severity === 'moderate' && { color: Colors.error, fontFamily: 'Geist-Bold' }]}>{isEnglish ? 'Moderate' : 'Moderată'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.severityBtn, severity === 'severe' && { backgroundColor: '#D32F2F20', borderColor: '#D32F2F' }]}
            onPress={() => setSeverity('severe')}
          >
            <Text style={[styles.severityText, severity === 'severe' && { color: '#D32F2F', fontFamily: 'Geist-Bold' }]}>{isEnglish ? 'Severe' : 'Severă'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{isEnglish ? 'Did you contact the doctor?' : 'Ai contactat medicul?'}</Text>
        <View style={styles.photoRow}>
          <TouchableOpacity 
            style={[styles.toggleBtn, contactedDoctor && styles.toggleBtnActive]}
            onPress={() => setContactedDoctor(true)}
          >
            <Text style={[styles.toggleBtnText, contactedDoctor && styles.toggleBtnTextActive]}>{isEnglish ? 'Yes' : 'Da'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, !contactedDoctor && styles.toggleBtnActive]}
            onPress={() => setContactedDoctor(false)}
          >
            <Text style={[styles.toggleBtnText, !contactedDoctor && styles.toggleBtnTextActive]}>{isEnglish ? 'Not yet' : 'Nu încă'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{isEnglish ? 'Reaction photo (optional)' : 'Poză reacție (opțional)'}</Text>
        <TouchableOpacity style={styles.photoBox}>
          <Text style={styles.photoEmoji}>📷</Text>
          <Text style={styles.photoText}>{isEnglish ? 'Attach a photo of the reaction for the doctor' : 'Atașează o poză cu reacția pentru medic'}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>{isEnglish ? 'Observations' : 'Observații'}</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder={isEnglish ? 'Ex: The reaction appeared 10 minutes after the meal...' : 'Ex: Reacția a apărut la 10 minute după masă...'}
          placeholderTextColor={Colors.textTertiary}
          multiline
        />

        <TouchableOpacity 
          style={[styles.saveBtn, (!selectedFood || selectedSymptoms.length === 0 || !severity || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!selectedFood || selectedSymptoms.length === 0 || !severity || isSaving}
        >
          {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>{isEnglish ? 'Save reaction' : 'Salvează reacția'}</Text>}
        </TouchableOpacity>

      </ScrollView>

      {/* MODAL SEARCH ALIMENT */}
      <Modal visible={showSearchModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSearchModal(false)} style={styles.modalCloseBtn}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{isEnglish ? 'Choose suspected food' : 'Alege alimentul suspect'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.modalScroll}>
          {introducedFoods.length === 0 ? (
            <Text style={{ padding: Spacing.xl, textAlign: 'center', color: Colors.textSecondary }}>{isEnglish ? 'You have not introduced any foods yet.' : 'Nu ai introdus încă niciun aliment.'}</Text>
          ) : (
            introducedFoods.map(f => (
              <TouchableOpacity 
                key={f.id} 
                style={styles.searchResultItem}
                onPress={() => {
                  setSelectedFoodId(f.id);
                  setShowSearchModal(false);
                }}
              >
                <Text style={styles.searchResultName}>{f.name}</Text>
                <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>{isEnglish ? 'Introduced on' : 'Introdus pe'} {new Date(f.introducedAt as string).toLocaleDateString()}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  content: { flex: 1, padding: Spacing.xl },

  alertBox: { backgroundColor: '#D32F2F15', padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: '#D32F2F40', marginBottom: Spacing.md },
  alertTitle: { fontSize: 15, fontFamily: 'Geist-Bold', color: '#D32F2F', marginBottom: 4 },
  alertText: { fontSize: 13, fontFamily: 'Geist', color: '#D32F2F', lineHeight: 18 },

  label: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.xl },
  foodSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  selectedFoodText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.error },
  placeholderText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textTertiary },
  selectorIcon: { fontSize: 20, color: Colors.textSecondary },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  chipText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },

  severityRow: { flexDirection: 'row', gap: Spacing.sm },
  severityBtn: { flex: 1, backgroundColor: Colors.white, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  severityText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },

  photoRow: { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn: { flex: 1, backgroundColor: Colors.white, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  toggleBtnActive: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  toggleBtnText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  toggleBtnTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },

  photoBox: { height: 80, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm },
  photoEmoji: { fontSize: 24 },
  photoText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary },

  input: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md, fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },

  saveBtn: { backgroundColor: Colors.error, height: 56, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', marginTop: Spacing['2xl'], ...Shadow.sm },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.white },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCloseBtn: { width: 40, height: 40, justifyContent: 'center' },
  modalCloseText: { fontSize: 24, color: Colors.textPrimary },
  modalTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  modalScroll: { flex: 1 },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultName: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
});
