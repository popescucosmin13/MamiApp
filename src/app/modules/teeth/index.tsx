import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Platform } from 'react-native';
import { AppDatePicker } from '../../../components/ui/AppDatePicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Crown, PartyPopper, Sparkles, Star } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../stores/authStore';
import { useChild } from '../../../hooks/useChild';
import { teethService } from '../../../services/teethService';
import type { ToothStatus, ToothType, Jaw, ToothDef, TeethState } from '../../../types/teeth';

const TEETH: ToothDef[] = [
  // Diagrama e din perspectivă externă (ca la dentist): stânga diagramei = dreapta bebelușului
  { id: 'u5', name: 'Molar II',        jaw: 'upper', side: 'dreapta', type: 'molar',   eruptionAge: '25-33 luni' },
  { id: 'u4', name: 'Molar I',         jaw: 'upper', side: 'dreapta', type: 'molar',   eruptionAge: '13-19 luni' },
  { id: 'u3', name: 'Canin',           jaw: 'upper', side: 'dreapta', type: 'canin',   eruptionAge: '16-22 luni' },
  { id: 'u2', name: 'Incisiv lateral', jaw: 'upper', side: 'dreapta', type: 'incisiv', eruptionAge: '9-13 luni' },
  { id: 'u1', name: 'Incisiv central', jaw: 'upper', side: 'dreapta', type: 'incisiv', eruptionAge: '8-12 luni' },
  { id: 'u6', name: 'Incisiv central', jaw: 'upper', side: 'stânga',  type: 'incisiv', eruptionAge: '8-12 luni' },
  { id: 'u7', name: 'Incisiv lateral', jaw: 'upper', side: 'stânga',  type: 'incisiv', eruptionAge: '9-13 luni' },
  { id: 'u8', name: 'Canin',           jaw: 'upper', side: 'stânga',  type: 'canin',   eruptionAge: '16-22 luni' },
  { id: 'u9', name: 'Molar I',         jaw: 'upper', side: 'stânga',  type: 'molar',   eruptionAge: '13-19 luni' },
  { id: 'u10',name: 'Molar II',        jaw: 'upper', side: 'stânga',  type: 'molar',   eruptionAge: '25-33 luni' },
  { id: 'l5', name: 'Molar II',        jaw: 'lower', side: 'dreapta', type: 'molar',   eruptionAge: '23-31 luni' },
  { id: 'l4', name: 'Molar I',         jaw: 'lower', side: 'dreapta', type: 'molar',   eruptionAge: '14-18 luni' },
  { id: 'l3', name: 'Canin',           jaw: 'lower', side: 'dreapta', type: 'canin',   eruptionAge: '17-23 luni' },
  { id: 'l2', name: 'Incisiv lateral', jaw: 'lower', side: 'dreapta', type: 'incisiv', eruptionAge: '10-16 luni' },
  { id: 'l1', name: 'Incisiv central', jaw: 'lower', side: 'dreapta', type: 'incisiv', eruptionAge: '6-10 luni' },
  { id: 'l6', name: 'Incisiv central', jaw: 'lower', side: 'stânga',  type: 'incisiv', eruptionAge: '6-10 luni' },
  { id: 'l7', name: 'Incisiv lateral', jaw: 'lower', side: 'stânga',  type: 'incisiv', eruptionAge: '10-16 luni' },
  { id: 'l8', name: 'Canin',           jaw: 'lower', side: 'stânga',  type: 'canin',   eruptionAge: '17-23 luni' },
  { id: 'l9', name: 'Molar I',         jaw: 'lower', side: 'stânga',  type: 'molar',   eruptionAge: '14-18 luni' },
  { id: 'l10',name: 'Molar II',        jaw: 'lower', side: 'stânga',  type: 'molar',   eruptionAge: '23-31 luni' },
];

const STATUS_COLOR:  Record<ToothStatus, string> = { none: '#F5EAEE', partial: '#FFD166', erupted: '#6ECFB0' };
const STATUS_BORDER: Record<ToothStatus, string> = { none: '#E0CCCF', partial: '#C8952A', erupted: '#3DAF8A' };
const STATUS_LABEL: Record<'ro' | 'en', Record<ToothStatus, string>> = {
  ro: { none: 'Neapărut', partial: 'În apariție', erupted: 'Apărut' },
  en: { none: 'Not erupted', partial: 'In progress', erupted: 'Erupted' },
};
const STATUS_ICON:  Record<ToothStatus, string> = { none: 'N', partial: 'P', erupted: 'E' };
const TERRA = '#C4704A';
const CREAM = '#FBF5EE';

function MilestoneIcon({ type, color, achieved }: { type: 'first' | 'four' | 'ten' | 'all'; color: string; achieved: boolean }) {
  const iconColor = achieved ? color : '#C8BAB0';
  const iconProps = { size: 30, color: iconColor, strokeWidth: 2.2 };
  return (
    <View style={[s.msIconWrap, { backgroundColor: `${iconColor}18` }]}>
      {type === 'first' && <Star {...iconProps} fill={`${iconColor}22`} />}
      {type === 'four' && <PartyPopper {...iconProps} />}
      {type === 'ten' && <Sparkles {...iconProps} />}
      {type === 'all' && <Crown {...iconProps} fill={`${iconColor}18`} />}
    </View>
  );
}

function toothName(name: string, lang: 'ro' | 'en'): string {
  if (lang === 'ro') return name;
  return name
    .replace('Molar II', 'Molar II')
    .replace('Molar I', 'Molar I')
    .replace('Canin', 'Canine')
    .replace('Incisiv lateral', 'Lateral incisor')
    .replace('Incisiv central', 'Central incisor');
}

function toothShortName(name: string, lang: 'ro' | 'en'): string {
  if (lang === 'ro') return name.replace('Incisiv ', 'Inc.\n').replace('Molar ', 'M.');
  return toothName(name, 'en').replace('Central ', 'C.\n').replace('Lateral ', 'L.\n').replace('Molar ', 'M.');
}

function toothSide(side: string, lang: 'ro' | 'en'): string {
  if (lang === 'ro') return side;
  return side.includes('dreapta') ? 'right' : 'left';
}

function ToothShape({ type, jaw, status }: { type: ToothType; jaw: Jaw; status: ToothStatus }) {
  const isLower = jaw === 'lower';
  const isMolar = type === 'molar';
  const br = isMolar ? 8 : type === 'canin' ? 10 : 6;
  return (
    <View style={{
      width: isMolar ? 32 : 26, height: 38,
      backgroundColor: STATUS_COLOR[status],
      borderWidth: 1.5, borderColor: STATUS_BORDER[status],
      borderTopLeftRadius: isLower ? 4 : br, borderTopRightRadius: isLower ? 4 : br,
      borderBottomLeftRadius: isLower ? br : 4, borderBottomRightRadius: isLower ? br : 4,
      shadowColor: STATUS_BORDER[status], shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
    }} />
  );
}

export default function TeethScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const lang: 'ro' | 'en' = i18n.language === 'en' ? 'en' : 'ro';
  const { user } = useAuthStore();
  const { activeChild } = useChild();

  const [teethState, setTeethState] = useState<TeethState>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [modalTooth, setModalTooth] = useState<ToothDef | null>(null);
  const [selStatus, setSelStatus]     = useState<ToothStatus>('none');
  const [selDate, setSelDate]         = useState(new Date());
  const [noteText, setNoteText]       = useState('');

  const load = useCallback(async () => {
    if (!user || !activeChild) return;
    try {
      const records = await teethService.getTeeth(user.uid, activeChild.id);
      const state: TeethState = {};
      for (const r of records) {
        state[r.id] = { status: r.status, date: r.date, note: r.note };
      }
      setTeethState(state);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, activeChild?.id]);

  useEffect(() => { load(); }, [load]);

  const openModal = (tooth: ToothDef) => {
    const cur = teethState[tooth.id];
    setModalTooth(tooth);
    setSelStatus(cur?.status ?? 'none');
    setSelDate(cur?.date ? new Date(cur.date) : new Date());
    setNoteText(cur?.note ?? '');
  };

  const saveModal = async () => {
    if (!modalTooth || !user || !activeChild) return;
    setSaving(true);
    try {
      const dateStr = selDate.toISOString().split('T')[0];
      const record = { id: modalTooth.id, status: selStatus, date: dateStr, note: noteText, updatedAt: new Date().toISOString() };
      await teethService.saveTooth(user.uid, activeChild.id, record);
      setTeethState(prev => ({ ...prev, [modalTooth.id]: { status: selStatus, date: dateStr, note: noteText } }));
      setModalTooth(null);
      Toast.show({ type: 'success', text1: selStatus === 'none' ? (lang === 'en' ? 'Deleted' : 'Șters') : (lang === 'en' ? 'Saved' : 'Salvat') });
    } catch {
      Toast.show({ type: 'error', text1: lang === 'en' ? 'Save error' : 'Eroare la salvare' });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!user || !activeChild) return;
    await teethService.deleteTooth(user.uid, activeChild.id, id);
    setTeethState(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    Toast.show({ type: 'success', text1: lang === 'en' ? 'Entry deleted' : 'Înregistrare ștearsă' });
  };

  const erupted   = TEETH.filter(t => teethState[t.id]?.status === 'erupted').length;
  const partial   = TEETH.filter(t => teethState[t.id]?.status === 'partial').length;
  const remaining = 20 - erupted - partial;
  const upperTeeth = TEETH.filter(t => t.jaw === 'upper');
  const lowerTeeth = TEETH.filter(t => t.jaw === 'lower');
  const timeline = TEETH
    .filter(t => teethState[t.id]?.status && teethState[t.id].status !== 'none')
    .sort((a, b) => (teethState[b.id]?.date ?? '').localeCompare(teethState[a.id]?.date ?? ''));

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <ActivityIndicator color={TERRA} style={{ marginTop: 60 }} size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{lang === 'en' ? 'Tooth map' : 'Harta dințișorilor'}</Text>
          <Text style={s.headerSub}>{lang === 'en' ? 'Saved in your account' : 'Salvat în contul tău'} · {activeChild?.name}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { num: erupted,   label: lang === 'en' ? 'erupted' : 'apăruți',  color: '#E8607A', border: '#FFB3C6' },
            { num: partial,   label: lang === 'en' ? 'in progress' : 'în curs',   color: '#C8952A', border: '#FFE08A' },
            { num: remaining, label: lang === 'en' ? 'remaining' : 'rămași',    color: '#3DAF8A', border: '#A8E6D0' },
          ].map(c => (
            <View key={c.label} style={[s.statCard, { borderColor: c.border }]}>
              <Text style={[s.statNum, { color: c.color }]}>{c.num}</Text>
              <Text style={s.statLbl}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={s.legend}>
          {(['erupted','partial','none'] as ToothStatus[]).map(st => (
            <View key={st} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: STATUS_COLOR[st], borderColor: STATUS_BORDER[st] }]} />
              <Text style={s.legendText}>{STATUS_LABEL[lang][st]}</Text>
            </View>
          ))}
        </View>

        {/* Diagram */}
        <View style={s.mouthCard}>
          {/* Orientare perspectivă externă — stânga diagramei = dreapta bebelușului */}
          <View style={s.orientRow}>
            <Text style={s.orientText}>{lang === 'en' ? 'Baby right' : 'Dreapta bebe'}</Text>
            <Text style={s.orientText}>{lang === 'en' ? 'Baby left' : 'Stânga bebe'}</Text>
          </View>
          <Text style={s.jawLabel}>{lang === 'en' ? 'Upper jaw' : 'Maxilar superior'}</Text>
          <View style={s.jawRow}>
            {upperTeeth.map(t => (
              <TouchableOpacity key={t.id} onPress={() => openModal(t)} activeOpacity={0.7} style={s.toothWrap}>
                <View style={s.toothBadgeWrap}>
                  <ToothShape type={t.type} jaw={t.jaw} status={teethState[t.id]?.status ?? 'none'} />
                  {teethState[t.id]?.status && teethState[t.id].status !== 'none' && (
                    <View style={[s.statusDot, { backgroundColor: STATUS_BORDER[teethState[t.id].status] }]} />
                  )}
                </View>
                <Text style={s.toothLabel} numberOfLines={2}>{toothShortName(t.name, lang)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.midDivider}>
            <View style={s.midLine} /><Text style={s.midText}>{lang === 'en' ? 'Midline' : 'Linia mediană'}</Text><View style={s.midLine} />
          </View>
          <View style={s.jawRow}>
            {lowerTeeth.map(t => (
              <TouchableOpacity key={t.id} onPress={() => openModal(t)} activeOpacity={0.7} style={s.toothWrap}>
                <View style={s.toothBadgeWrap}>
                  <ToothShape type={t.type} jaw={t.jaw} status={teethState[t.id]?.status ?? 'none'} />
                  {teethState[t.id]?.status && teethState[t.id].status !== 'none' && (
                    <View style={[s.statusDot, { backgroundColor: STATUS_BORDER[teethState[t.id].status] }]} />
                  )}
                </View>
                <Text style={s.toothLabel} numberOfLines={2}>{toothShortName(t.name, lang)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.jawLabel, { marginTop: 8 }]}>{lang === 'en' ? 'Lower jaw' : 'Mandibulă'}</Text>
        </View>

        {/* Milestones */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>{lang === 'en' ? 'Important milestones' : 'Etape importante'}</Text>
          <View style={s.milestonesGrid}>
            {[
              { label: lang === 'en' ? 'First tooth' : 'Primul dințișor', icon: 'first' as const, min: 1,  color: '#FFD166' },
              { label: lang === 'en' ? '4 teeth' : '4 dințișori',     icon: 'four' as const, min: 4,  color: '#6ECFB0' },
              { label: lang === 'en' ? '10 teeth' : '10 dințișori',    icon: 'ten' as const, min: 10, color: '#93C5FD' },
              { label: lang === 'en' ? 'All 20 teeth' : 'Toți 20',         icon: 'all' as const, min: 20, color: '#C084FC' },
            ].map(ms => {
              const achieved = erupted >= ms.min;
              return (
                <View key={ms.label} style={[s.msCard, achieved ? { opacity: 1, borderColor: ms.color + '80' } : { opacity: 0.45 }]}>
                  <MilestoneIcon type={ms.icon} color={ms.color} achieved={achieved} />
                  <Text style={s.msLabel}>{ms.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Timeline */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>{lang === 'en' ? 'Appearance journal' : 'Jurnal apariții'}</Text>
          {timeline.length === 0 ? (
            <View style={s.emptyTimeline}>
              <Text style={s.emptyEmoji}>🌱</Text>
              <Text style={s.emptyText}>{lang === 'en' ? 'Tap a tooth to record it.' : 'Apasă pe un dințișor pentru a înregistra!'}</Text>
            </View>
          ) : (
            timeline.map(t => {
              const st = teethState[t.id];
              const dateStr = st.date
                ? new Date(st.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
                : (lang === 'en' ? 'Unspecified date' : 'Dată nespecificată');
              return (
                <View key={t.id} style={[s.timelineItem, st.status === 'partial' && { borderLeftColor: '#FFD166' }]}>
                  <View style={[s.tlDot, { backgroundColor: st.status === 'partial' ? '#FFF3CC' : '#C8EDE3' }]}>
                    <Text style={{ fontSize: 16 }}>{t.type === 'molar' ? '🦷' : t.type === 'canin' ? '🐾' : '😁'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tlName}>{toothName(t.name, lang)} {toothSide(t.side, lang)} · {t.jaw === 'upper' ? (lang === 'en' ? 'upper' : 'sup.') : (lang === 'en' ? 'lower' : 'inf.')}</Text>
                    <Text style={s.tlDate}>{dateStr}</Text>
                    {st.note ? <Text style={s.tlNote}>{st.note}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[s.tlBadge, { backgroundColor: st.status === 'erupted' ? '#C8EDE3' : '#FFF3CC' }]}>
                      <Text style={[s.tlBadgeText, { color: st.status === 'erupted' ? '#3D9B7A' : '#B87A20' }]}>{STATUS_LABEL[lang][st.status]}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteEntry(t.id)}>
                      <Text style={{ color: '#C46B4F', fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal */}
      <Modal visible={!!modalTooth} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{modalTooth ? toothName(modalTooth.name, lang) : ''}</Text>
            <Text style={s.modalSub}>
              {modalTooth?.jaw === 'upper' ? (lang === 'en' ? 'Upper jaw' : 'Maxilar superior') : (lang === 'en' ? 'Lower jaw' : 'Mandibulă')} · {modalTooth ? toothSide(modalTooth.side, lang) : ''}{'\n'}
              {lang === 'en' ? 'Typical age' : 'Vârstă tipică'}: {modalTooth?.eruptionAge.replace('luni', lang === 'en' ? 'months' : 'luni')}
            </Text>
            <Text style={s.fieldLabel}>{lang === 'en' ? 'TOOTH STATUS' : 'STARE DINȚIȘOR'}</Text>
            <View style={s.statePicker}>
              {(['none','partial','erupted'] as ToothStatus[]).map(st => (
                <TouchableOpacity key={st} style={[s.stateOption, selStatus === st && { borderColor: STATUS_BORDER[st], backgroundColor: STATUS_COLOR[st] + '60' }]} onPress={() => setSelStatus(st)}>
                  <Text style={s.stateIcon}>{STATUS_ICON[st]}</Text>
                  <Text style={s.stateLabel}>{STATUS_LABEL[lang][st]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selStatus !== 'none' && (
              <>
                <Text style={s.fieldLabel}>{lang === 'en' ? 'APPEARANCE DATE' : 'DATA APARIȚIEI'}</Text>
                <AppDatePicker
                  value={selDate}
                  onChange={setSelDate}
                  mode="date"
                  style={{
                    borderWidth: 1.5, borderColor: '#EDE3D6', borderRadius: 14,
                    backgroundColor: '#FFFBF5', width: '100%', marginBottom: 12
                  }}
                />
              </>
            )}
            <Text style={s.fieldLabel}>{lang === 'en' ? 'NOTES (OPTIONAL)' : 'NOTIȚE (OPȚIONAL)'}</Text>
            <TextInput style={[s.input, { height: 70 }]} value={noteText} onChangeText={setNoteText} placeholder={lang === 'en' ? 'Ex: cried a lot, mild fever...' : 'Ex: A plâns mult, febră ușoară...'} multiline />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setModalTooth(null)}>
                <Text style={s.btnCancelText}>{lang === 'en' ? 'Cancel' : 'Anulează'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSave} onPress={saveModal} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSaveText}>{lang === 'en' ? 'Save' : 'Salvează'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: CREAM },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CREAM },
  backBtn:      { marginRight: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0E8E0', alignItems: 'center', justifyContent: 'center' },
  backText:     { fontSize: 22, color: TERRA, lineHeight: 28 },
  headerTitle:  { fontSize: 18, fontFamily: 'Fraunces', color: '#1C130D' },
  headerSub:    { fontSize: 11, fontFamily: 'Geist', color: '#9A8070', marginTop: 1 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:     { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, shadowColor: '#1C130D', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  statNum:      { fontSize: 28, fontFamily: 'Fraunces', lineHeight: 32 },
  statLbl:      { fontSize: 10, fontFamily: 'Geist-SemiBold', color: '#9A8070', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  legend:       { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 16 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  legendText:   { fontSize: 11, fontFamily: 'Geist-SemiBold', color: '#5A4030' },
  mouthCard:    { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#1C130D', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:16, elevation:4 },
  orientRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orientText:   { fontSize: 9, fontFamily: 'Geist', color: '#C8BAB0', letterSpacing: 0.3 },
  jawLabel:     { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#C8BAB0', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  jawRow:       { flexDirection: 'row', justifyContent: 'center', gap: 3, paddingVertical: 6 },
  toothWrap:    { alignItems: 'center', gap: 3, width: 32 },
  toothBadgeWrap:{ position: 'relative' },
  statusDot:    { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#FFF' },
  toothLabel:   { fontSize: 7, fontFamily: 'Geist', color: '#9A8070', textAlign: 'center', lineHeight: 9 },
  midDivider:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  midLine:      { flex: 1, height: 1, backgroundColor: '#F0E0D8' },
  midText:      { fontSize: 10, fontFamily: 'Geist-SemiBold', color: '#C8BAB0' },
  sectionCard:  { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#1C130D', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:16, elevation:4 },
  sectionTitle: { fontFamily: 'Fraunces', fontSize: 16, color: '#1C130D', marginBottom: 14 },
  milestonesGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  msCard:       { width: '47%', backgroundColor: '#FFFBF5', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE3D6', gap: 6 },
  msIconWrap:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  msLabel:      { fontSize: 11, fontFamily: 'Geist-SemiBold', color: '#5A4030', textAlign: 'center' },
  emptyTimeline:{ alignItems: 'center', paddingVertical: 24 },
  emptyEmoji:   { fontSize: 36, marginBottom: 8 },
  emptyText:    { fontSize: 13, fontFamily: 'Geist', color: '#9A8070', textAlign: 'center' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFFBF5', borderRadius: 14, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#6ECFB0' },
  tlDot:        { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tlName:       { fontSize: 13, fontFamily: 'Geist-SemiBold', color: '#1C130D' },
  tlDate:       { fontSize: 11, fontFamily: 'Geist', color: '#9A8070', marginTop: 2 },
  tlNote:       { fontSize: 11, fontFamily: 'Geist', color: '#5A4030', marginTop: 2, fontStyle: 'italic' },
  tlBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tlBadgeText:  { fontSize: 10, fontFamily: 'Geist-SemiBold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,19,13,0.45)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 },
  modalTitle:   { fontFamily: 'Fraunces', fontSize: 22, color: '#1C130D', textAlign: 'center', marginBottom: 4 },
  modalSub:     { fontFamily: 'Geist', fontSize: 12, color: '#9A8070', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  fieldLabel:   { fontSize: 10, fontFamily: 'Geist-SemiBold', color: '#9A8070', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  statePicker:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stateOption:  { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#EDE3D6', backgroundColor: '#FFFBF5' },
  stateIcon:    { fontSize: 20, marginBottom: 4 },
  stateLabel:   { fontSize: 10, fontFamily: 'Geist-SemiBold', color: '#5A4030', textAlign: 'center' },
  input:        { borderWidth: 1.5, borderColor: '#EDE3D6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Geist', fontSize: 14, color: '#1C130D', marginBottom: 12, backgroundColor: '#FFFBF5' },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel:    { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F0E8E0', alignItems: 'center' },
  btnCancelText:{ fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#5A4030' },
  btnSave:      { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: TERRA, alignItems: 'center' },
  btnSaveText:  { fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#FFFFFF' },
});
