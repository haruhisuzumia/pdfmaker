import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { Doc } from '@/db/schema';
import { badgeFor, formatDocDate, formatSize } from '@/lib/documents';

import { LocationBadge } from './LocationBadge';

type Props = {
  doc: Doc;
  onPress: (doc: Doc) => void;
};

export function docSubtitle(doc: Doc) {
  const pages = doc.pageCount > 0 ? `${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'} · ` : '';
  return `${pages}${formatSize(doc.sizeBytes)} · ${formatDocDate(doc.updatedAt)}`;
}

export function DocRow({ doc, onPress }: Props) {
  const theme = useTheme();
  return (
    <TouchableRipple onPress={() => onPress(doc)} accessibilityRole="button">
      <View style={styles.row}>
        <View style={[styles.thumb, { backgroundColor: theme.colors.surfaceVariant }]}>
          {doc.thumbPath ? (
            <Image source={{ uri: doc.thumbPath }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons
              name={doc.kind === 'pdf' ? 'file-pdf-box' : 'file-image-outline'}
              size={28}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>
        <View style={styles.text}>
          <Text variant="titleSmall" numberOfLines={1}>
            {doc.title}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
            {docSubtitle(doc)}
          </Text>
        </View>
        <LocationBadge badge={badgeFor(doc.syncState)} />
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  thumb: { width: 44, height: 56, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
