import { Stack, usePathname } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { AccessDenied } from '../../components/AccessDenied';
import { useAccessControl } from '../../hooks/useAccessControl';
import { Colors } from '../../theme/colors';

export default function ModulesLayout() {
  const pathname = usePathname();
  const { canUseRoutePath, isLoadingAccess, modules } = useAccessControl();

  if (isLoadingAccess) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.child.primary} />
      </View>
    );
  }

  if (!canUseRoutePath(pathname)) {
    const moduleId = pathname.split('/')[2];
    const modConfig = modules?.[moduleId];
    
    return (
      <AccessDenied 
        title={modConfig?.deniedTitle || undefined} 
        message={modConfig?.deniedMessage || undefined} 
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
