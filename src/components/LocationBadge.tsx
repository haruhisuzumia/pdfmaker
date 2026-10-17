import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import type { Badge } from '@/lib/documents';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICONS: Record<Badge, { icons: IconName[]; label: string }> = {
  phone: { icons: ['cellphone'], label: 'On phone' },
  drive: { icons: ['cloud-outline'], label: 'On Google Drive' },
  both: { icons: ['cellphone', 'cloud-check-outline'], label: 'On phone and Google Drive' },
  uploading: { icons: ['cloud-upload-outline'], label: 'Uploading to Google Drive' },
  error: { icons: ['cloud-alert-outline'], label: 'Upload failed' },
};

export function LocationBadge({ badge }: { badge: Badge }) {
  const theme = useTheme();
  const { icons, label } = ICONS[badge];
  const color = badge === 'error' ? theme.colors.error : theme.colors.onSurfaceVariant;

  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      {icons.map((name) => (
        <MaterialCommunityIcons key={name} name={name} size={18} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
