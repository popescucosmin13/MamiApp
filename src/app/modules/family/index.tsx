import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { useAccessControl } from '../../../hooks/useAccessControl';
import { childService } from '../../../services/childService';
import { db, getFirebaseFunctions } from '../../../services/firebase';
import { Child } from '../../../types/child';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { AppDatePicker } from '../../../components/ui/AppDatePicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'grandparent' | 'caregiver' | 'other';
  status: 'active' | 'pending';
  source?: 'owner' | 'outgoing' | 'incoming';
  token?: string;
  memberUid?: string;
  childId?: string;
  permissions: {
    viewTracking: boolean;
    viewGrowth: boolean;
    viewVaccines: boolean;
    viewDocuments: boolean;
    addRecords: boolean;
  };
}

const ROLE_LABEL_KEYS: Record<string, string> = {
  parent: 'family.role_parent', grandparent: 'family.role_grandparent',
  caregiver: 'family.role_caregiver', other: 'family.role_other',
};
const ROLE_EMOJIS: Record<string, string> = {
  parent: '👨‍👩‍👧', grandparent: '👴', caregiver: '👩‍⚕️', other: '👤',
};

// ─── Child Edit Modal ─────────────────────────────────────────────────────────

function ChildModal({
  visible,
  child,
  onClose,
  onSave,
}: {
  visible: boolean;
  child: Child | null; // null = adaugă nou
  onClose: () => void;
  onSave: (data: Partial<Child> & { birthDate: Timestamp }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [birthDate, setBirthDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (child) {
      setName(child.name || '');
      setGender(child.gender || 'other');
      setBirthDate(child.birthDate ? child.birthDate.toDate() : new Date());
    } else {
      setName('');
      setGender('other');
      setBirthDate(new Date());
    }
  }, [child, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Eroare', 'Introdu numele bebelușului.');
      return;
    }
    if (!birthDate) {
      Alert.alert('Eroare', 'Selectează data nașterii.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        gender,
        birthDate: Timestamp.fromDate(birthDate),
      });
      onClose();
    } catch (err: any) {
      console.warn('Invite failed', err);
      Alert.alert('Eroare', 'Nu am putut salva. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>{child ? '✏️ Editează bebeluș' : '👶 Adaugă bebeluș'}</Text>

          <Text style={modal.label}>Numele bebelușului</Text>
          <TextInput
            style={modal.input}
            value={name}
            onChangeText={setName}
            placeholder={t('family.baby_placeholder')}
            placeholderTextColor={Colors.textTertiary}
          />

          <Text style={modal.label}>{t('family.gender')}</Text>
          <View style={modal.genderRow}>
            {(['female', 'male', 'other'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[modal.genderBtn, gender === g && modal.genderBtnActive]}
                onPress={() => setGender(g)}
              >
                <Text style={modal.genderEmoji}>
                  {g === 'female' ? '👧' : g === 'male' ? '👦' : '🤍'}
                </Text>
                <Text style={[modal.genderLabel, gender === g && modal.genderLabelActive]}>
                  {g === 'female' ? 'Fată' : g === 'male' ? 'Băiat' : 'Necunoscut'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={modal.label}>Data nașterii</Text>
          <AppDatePicker
            value={birthDate}
            onChange={setBirthDate}
            mode="date"
            style={{
              borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
              backgroundColor: '#FFFFFF', width: '100%', marginBottom: 20
            }}
          />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={modal.cancelText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={modal.saveText}>Salvează</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeChild, setActiveChild } = useChildStore();
  const { canUseModule } = useAccessControl();

  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childModalVisible, setChildModalVisible] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [switchingChild, setSwitchingChild] = useState<string | null>(null);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [incomingMembers, setIncomingMembers] = useState<FamilyMember[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<FamilyMember['role']>('parent');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadChildren();
    loadInvitations();
    loadIncomingSharedFamilies();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'invitations'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setFamilyMembersFromInvitations(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (err) => {
      console.warn('Nu am putut asculta invitatiile', err);
    });
  }, [profile?.email, user?.email, user?.uid]);

  const loadChildren = async () => {
    if (!user) return;
    setLoadingChildren(true);
    try {
      const all = await childService.getAllChildren(user.uid);
      setChildren(all);
    } catch {
      // ignore
    } finally {
      setLoadingChildren(false);
    }
  };

  const loadInvitations = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'users', user.uid, 'invitations'),
        orderBy('createdAt', 'desc')
      ));
      setFamilyMembersFromInvitations(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.warn('Nu am putut incarca invitatiile', err);
    }
  };

  const loadIncomingSharedFamilies = async () => {
    if (!user) return;
    try {
      const functions = await getFirebaseFunctions();
      const syncSharedFamilyMetadata = httpsCallable(functions, 'syncSharedFamilyMetadata');
      await syncSharedFamilyMetadata().catch(() => {});
      const snap = await getDocs(collection(db, 'users', user.uid, 'shared_children'));
      setIncomingMembers(snap.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.ownerName || t('family.shared_family'),
            email: data.ownerEmail || t('family.email_unavailable'),
            role: (data.role || 'parent') as FamilyMember['role'],
            status: 'active' as const,
            source: 'incoming' as const,
            childId: data.childId,
            permissions: {
              viewTracking: data.permissions?.viewTracking ?? true,
              viewGrowth: data.permissions?.viewGrowth ?? true,
              viewVaccines: data.permissions?.viewVaccines ?? true,
              viewDocuments: data.permissions?.viewDocuments ?? false,
              addRecords: data.permissions?.addRecords ?? false,
            },
          };
        })
        .filter((member) => member.childId));
    } catch (err) {
      console.warn('Nu am putut incarca familiile partajate', err);
    }
  };

  const setFamilyMembersFromInvitations = (invitations: Array<{ id: string; [key: string]: any }>) => {
    const invitedMembers: FamilyMember[] = invitations
      .filter((data) => !data.status || data.status === 'pending' || data.status === 'accepted')
      .map((data) => ({
        id: data.id,
        name: String(data.email || '').split('@')[0] || t('family.guest'),
        email: String(data.email || ''),
        role: (data.role || 'parent') as FamilyMember['role'],
        status: (data.status === 'accepted' ? 'active' : 'pending') as 'active' | 'pending',
        source: 'outgoing' as const,
        token: data.id,
        memberUid: data.acceptedBy,
        childId: data.childId,
        permissions: {
          viewTracking: data.permissions?.viewTracking ?? true,
          viewGrowth: data.permissions?.viewGrowth ?? true,
          viewVaccines: data.permissions?.viewVaccines ?? true,
          viewDocuments: data.permissions?.viewDocuments ?? false,
          addRecords: data.permissions?.addRecords ?? false,
        },
      }))
      .filter((member) => member.email);

    setMembers(invitedMembers);
  };

  const ownerMember: FamilyMember = {
    id: 'owner',
    name: t('family.owner'),
    email: profile?.email || user?.email || '',
    role: 'parent',
    status: 'active',
    source: 'owner',
    permissions: { viewTracking: true, viewGrowth: true, viewVaccines: true, viewDocuments: true, addRecords: true },
  };
  const visibleMembers = [ownerMember, ...members, ...incomingMembers];

  const handleSaveChild = async (data: Partial<Child> & { birthDate: Timestamp }) => {
    if (!user) return;
    if (editingChild) {
      await childService.updateChild(user.uid, editingChild.id, data);
      setChildren(prev => prev.map(c => c.id === editingChild.id ? { ...c, ...data } : c));
    } else {
      const newId = await childService.createOrGetChild(user.uid, {
        name: data.name!,
        gender: data.gender!,
        birthDate: data.birthDate,
        birthWeight: 0, birthHeight: 0,
        birthHeadCircumference: 0,
        birthType: 'natural',
        isActive: false,
      });
      // Rulăm în paralel — vaccinuri + milestone-uri — pentru viteză maximă
      await Promise.allSettled([
        childService.initializeVaccines(user.uid, newId, data.birthDate.toDate()),
        childService.initializeMilestones(user.uid, newId),
      ]);
      await loadChildren();
    }
  };

  const handleSwitchChild = async (child: Child) => {
    if (!user || child.id === activeChild?.id) return;
    setSwitchingChild(child.id);
    try {
      if (!child.isShared) {
        await childService.setActiveChild(user.uid, child.id);
      }
      setActiveChild(child);
      setChildren(prev => prev.map(c => ({ ...c, isActive: c.id === child.id })));
      Alert.alert('✅ Schimbat!', `Acum urmărești activitatea lui ${child.name}.`);
    } catch {
      Alert.alert('Eroare', 'Nu am putut schimba bebelușul activ.');
    } finally {
      setSwitchingChild(null);
    }
  };

  const handleDeleteChild = (child: Child) => {
    if (child.isShared) {
      Alert.alert(t('family.shared_child_title'), t('family.shared_child_msg'));
      return;
    }
    const message = t('family.delete_child_msg', { name: child.name });
    const runDelete = async () => {
      if (!user) return;
      try {
        await childService.archiveChild(user.uid, child.id);
        const remaining = children.filter((item) => item.id !== child.id);
        let nextActive = remaining.find((item) => item.isActive) ?? remaining[0] ?? null;
        if (child.isActive && nextActive) {
          await childService.setActiveChild(user.uid, nextActive.id);
          nextActive = { ...nextActive, isActive: true };
        }
        setChildren(remaining.map((item) => ({ ...item, isActive: nextActive?.id === item.id })));
        setActiveChild(nextActive);
        Alert.alert(t('family.deleted_title'), t('family.deleted_msg'));
      } catch {
        Alert.alert(t('family.error'), t('family.delete_child_error'));
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) runDelete();
      return;
    }
    Alert.alert(t('family.delete_child_title'), message, [
      { text: t('family.cancel'), style: 'cancel' },
      { text: t('family.delete'), style: 'destructive', onPress: runDelete },
    ]);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Email invalid', 'Introduceți o adresă de email validă.');
      return;
    }
    const targetChildId = activeChild?.id || children.find((child) => child.isActive)?.id || children[0]?.id || '';
    if (!targetChildId) {
      Alert.alert(t('family.choose_child'), t('family.choose_child_msg'));
      return;
    }
    setSending(true);
    try {
      const functions = await getFirebaseFunctions();
      const inviteFamilyMember = httpsCallable(functions, 'inviteFamilyMember');
      const defaultPermissions = inviteRole === 'grandparent'
        ? { viewTracking: true, viewGrowth: true, viewVaccines: true, viewDocuments: false, addRecords: false }
        : inviteRole === 'caregiver'
        ? { viewTracking: true, viewGrowth: true, viewVaccines: true, viewDocuments: false, addRecords: true }
        : { viewTracking: true, viewGrowth: true, viewVaccines: true, viewDocuments: true, addRecords: true };
      await inviteFamilyMember({
        email: inviteEmail.trim(), role: inviteRole,
        permissions: defaultPermissions, childId: targetChildId,
      });
      await loadInvitations();
      setShowInvite(false);
      setInviteEmail('');
      Alert.alert('Invitație trimisă', `Un email a fost trimis la ${inviteEmail}.`);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut trimite invitația.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteInvitation = (member: FamilyMember) => {
    if (!member.token) return;
    const message = t('family.delete_invite_msg', { email: member.email });
    const runDelete = async () => {
      try {
        const functions = await getFirebaseFunctions();
        const deleteFamilyInvitation = httpsCallable(functions, 'deleteFamilyInvitation');
        await deleteFamilyInvitation({ token: member.token });
        await loadInvitations();
        Alert.alert(t('family.invite_deleted'), t('family.invite_deleted_msg'));
      } catch (error: any) {
        Alert.alert('Eroare', error?.message || t('family.delete_invite_error'));
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) runDelete();
      return;
    }
    Alert.alert(t('family.delete_invite_title'), message, [
      { text: t('family.cancel'), style: 'cancel' },
      { text: t('family.delete'), style: 'destructive', onPress: runDelete },
    ]);
  };

  const handleRevokeAccess = (member: FamilyMember) => {
    if (!member.memberUid) return;
    const message = t('family.revoke_msg', { name: member.name || member.email });
    const runRevoke = async () => {
      try {
        const functions = await getFirebaseFunctions();
        const revokeFamilyAccess = httpsCallable(functions, 'revokeFamilyAccess');
        await revokeFamilyAccess({
          memberUid: member.memberUid,
          token: member.token,
          childId: member.childId,
        });
        await loadInvitations();
        Alert.alert(t('family.access_revoked'), t('family.access_revoked_msg'));
      } catch (error: any) {
        Alert.alert('Eroare', error?.message || t('family.revoke_error'));
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) runRevoke();
      return;
    }
    Alert.alert(t('family.revoke_title'), message, [
      { text: t('family.cancel'), style: 'cancel' },
      { text: t('family.revoke'), style: 'destructive', onPress: runRevoke },
    ]);
  };

  const ageDisplay = (child: Child) => {
    if (!child.birthDate) return '';
    const days = Math.floor((Date.now() - child.birthDate.toDate().getTime()) / 86400000);
    if (days < 30) return `${days} zile`;
    if (days < 365) return `${Math.floor(days / 30)} luni`;
    return `${Math.floor(days / 365)} ani ${Math.floor((days % 365) / 30)} luni`;
  };

  // Ecran locked dacă modulul e Premium și userul nu are acces
  if (!canUseModule('family')) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('family.title')}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>👨‍👩‍👦</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Fraunces', color: Colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>{t('family.premium_title')}</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28, maxWidth: 300 }}>{t('family.premium_desc')}</Text>
          <TouchableOpacity
            style={{ backgroundColor: Colors.child.primary, borderRadius: BorderRadius.lg, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 }}
            onPress={() => router.push('/modules/settings/subscription')}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white }}>Activează Premium</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', maxWidth: 280 }}>
            Sau activează modulul din panoul de administrare.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('family.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Copiii mei ───────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('family.my_children')}</Text>
            <TouchableOpacity
              style={styles.addChildBtn}
              onPress={() => { setEditingChild(null); setChildModalVisible(true); }}
            >
              <Text style={styles.addChildBtnText}>+ Adaugă</Text>
            </TouchableOpacity>
          </View>

          {loadingChildren ? (
            <ActivityIndicator color={Colors.child.primary} />
          ) : children.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>👶</Text>
              <Text style={styles.emptyText}>{t('family.empty_children')}</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => { setEditingChild(null); setChildModalVisible(true); }}
              >
                <Text style={styles.emptyBtnText}>{t('family.add_first')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            children.map(child => (
              <View key={child.id} style={[styles.childCard, child.isActive && styles.childCardActive]}>
                <View style={styles.childLeft}>
                  <View style={[styles.childAvatar, child.isActive && { backgroundColor: Colors.child.primary + '30' }]}>
                    <Text style={styles.childAvatarEmoji}>
                      {child.gender === 'female' ? '👧' : child.gender === 'male' ? '👦' : '👶'}
                    </Text>
                  </View>
                  <View style={styles.childInfo}>
                    <View style={styles.childNameRow}>
                      <Text style={styles.childName}>{child.name}</Text>
                      {child.isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>{t('family.active')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.childAge}>{ageDisplay(child)}</Text>
                  </View>
                </View>
                <View style={styles.childActions}>
                  {!child.isShared && (
                    <>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => { setEditingChild(child); setChildModalVisible(true); }}
                  >
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteChild(child)}
                  >
                    <Text style={styles.deleteBtnText}>{t('family.delete')}</Text>
                  </TouchableOpacity>
                    </>
                  )}
                  {!child.isActive && (
                    <TouchableOpacity
                      style={[styles.switchBtn, switchingChild === child.id && { opacity: 0.6 }]}
                      onPress={() => handleSwitchChild(child)}
                      disabled={switchingChild === child.id}
                    >
                      {switchingChild === child.id ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Text style={styles.switchBtnText}>{t('family.set_active')}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Membrii familiei ──────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('family.family_members')}</Text>
            <TouchableOpacity style={styles.addChildBtn} onPress={() => setShowInvite(!showInvite)}>
              <Text style={styles.addChildBtnText}>+ Invită</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{t('family.info')}</Text>
          </View>

          {showInvite && (
            <View style={styles.inviteCard}>
              <Text style={styles.inviteTitle}>{t('family.invite_one')}</Text>
              <Text style={styles.fieldLabel}>{t('family.email')}</Text>
              <TextInput
                style={styles.input}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="email@exemplu.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>{t('family.role')}</Text>
              <View style={styles.roleRow}>
                {(Object.keys(ROLE_LABEL_KEYS) as FamilyMember['role'][]).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, inviteRole === role && styles.roleChipActive]}
                    onPress={() => setInviteRole(role)}
                  >
                    <Text>{ROLE_EMOJIS[role]}</Text>
                    <Text style={[styles.roleText, inviteRole === role && styles.roleTextActive]}>
                      {t(ROLE_LABEL_KEYS[role])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.inviteActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
                  <Text style={styles.cancelBtnText}>{t('family.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={handleInvite} disabled={sending}>
                  {sending ? <ActivityIndicator color={Colors.white} size="small" /> :
                    <Text style={styles.sendBtnText}>{t('family.send_invite')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {visibleMembers.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <View style={styles.memberAvatar}>
                  <Text style={{ fontSize: 22 }}>{ROLE_EMOJIS[member.role]}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                  <Text style={styles.memberRole}>{t(ROLE_LABEL_KEYS[member.role])}</Text>
                </View>
                {member.status === 'pending' && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>{t('family.pending')}</Text>
                  </View>
                )}
                {member.source === 'outgoing' && member.status === 'pending' && (
                  <TouchableOpacity style={styles.memberActionBtn} onPress={() => handleDeleteInvitation(member)}>
                    <Text style={styles.memberActionText}>{t('family.delete')}</Text>
                  </TouchableOpacity>
                )}
                {member.source === 'outgoing' && member.status === 'active' && (
                  <TouchableOpacity style={styles.memberDangerBtn} onPress={() => handleRevokeAccess(member)}>
                    <Text style={styles.memberDangerText}>{t('family.revoke')}</Text>
                  </TouchableOpacity>
                )}
                {member.source === 'incoming' && (
                  <View style={styles.sharedBadge}>
                    <Text style={styles.sharedText}>{t('family.shared')}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>{t('family.privacy_title')}</Text>
          <Text style={styles.privacyText}>{t('family.privacy_text')}</Text>
        </View>
      </ScrollView>

      <ChildModal
        visible={childModalVisible}
        child={editingChild}
        onClose={() => setChildModalVisible(false)}
        onSave={handleSaveChild}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  addChildBtn: {
    backgroundColor: Colors.child.primary, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
  },
  addChildBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  emptyCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    alignItems: 'center', ...Shadow.sm,
  },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.sm },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.md },
  emptyBtn: {
    backgroundColor: Colors.child.primary, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  childCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md,
    marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', ...Shadow.sm,
    borderWidth: 2, borderColor: 'transparent',
  },
  childCardActive: { borderColor: Colors.child.primary },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  childAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  childAvatarEmoji: { fontSize: 24 },
  childInfo: { flex: 1 },
  childNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  childName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  activeBadge: {
    backgroundColor: Colors.child.primary + '20', paddingHorizontal: Spacing.xs,
    paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.child.primaryDark },
  childAge: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  childActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  editBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontSize: 16 },
  switchBtn: {
    backgroundColor: Colors.child.primary, paddingHorizontal: Spacing.sm,
    paddingVertical: 6, borderRadius: BorderRadius.lg,
  },
  switchBtnText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  deleteBtn: {
    backgroundColor: Colors.error + '15', paddingHorizontal: Spacing.sm,
    paddingVertical: 6, borderRadius: BorderRadius.lg,
  },
  deleteBtnText: { fontSize: 11, fontWeight: '700', color: Colors.error },
  infoBanner: {
    backgroundColor: Colors.child.primaryLight, borderRadius: BorderRadius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  inviteCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, marginBottom: Spacing.md, ...Shadow.sm,
  },
  inviteTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, fontSize: 14, color: Colors.textPrimary, marginBottom: Spacing.lg,
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundSoft,
    borderWidth: 1, borderColor: Colors.border,
  },
  roleChipActive: { backgroundColor: Colors.family + '20', borderColor: Colors.family },
  roleText: { fontSize: 13, color: Colors.textSecondary },
  roleTextActive: { color: Colors.family, fontWeight: '600' },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: Colors.family, borderColor: Colors.family },
  checkmark: { fontSize: 13, color: Colors.white },
  permLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  inviteActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: BorderRadius.xl, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  sendBtn: {
    flex: 1, height: 44, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.family, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  memberCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  memberHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.family + '20',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberEmail: { fontSize: 12, color: Colors.textTertiary },
  memberRole: { fontSize: 12, fontWeight: '600', color: Colors.family },
  pendingBadge: {
    backgroundColor: Colors.warning + '20', paddingHorizontal: Spacing.xs,
    paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  pendingText: { fontSize: 10, fontWeight: '600', color: Colors.warning },
  memberActionBtn: {
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.sm,
    paddingVertical: 6, borderRadius: BorderRadius.lg,
  },
  memberActionText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  memberDangerBtn: {
    backgroundColor: Colors.error + '15', paddingHorizontal: Spacing.sm,
    paddingVertical: 6, borderRadius: BorderRadius.lg,
  },
  memberDangerText: { fontSize: 11, fontWeight: '700', color: Colors.error },
  sharedBadge: {
    backgroundColor: Colors.info + '15', paddingHorizontal: Spacing.xs,
    paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  sharedText: { fontSize: 10, fontWeight: '600', color: Colors.info },
  privacyCard: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.xl, marginBottom: Spacing['2xl'],
    backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  privacyTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.xs },
  privacyText: { fontSize: 12, color: Colors.textTertiary, lineHeight: 18 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.md,
    height: 48, fontSize: 15, color: Colors.textPrimary, marginBottom: Spacing.lg,
  },
  genderRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  genderBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, alignItems: 'center', gap: Spacing.xs,
  },
  genderBtnActive: { borderColor: Colors.child.primary, backgroundColor: Colors.child.primaryLight },
  genderEmoji: { fontSize: 24 },
  genderLabel: { fontSize: 12, color: Colors.textSecondary },
  genderLabelActive: { fontWeight: '600', color: Colors.child.primaryDark },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 2, height: 48, borderRadius: 14,
    backgroundColor: Colors.child.primary, alignItems: 'center', justifyContent: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
