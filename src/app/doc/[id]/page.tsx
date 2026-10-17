import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ZoomableImage } from '@/components/ZoomableImage';
import { documentByIdQuery } from '@/db/documents';
import { ensurePages, type PageImage } from '@/storage/pageStore';

export default function PageViewerScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];

  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [current, setCurrent] = useState(Number(index ?? 0));
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (doc) ensurePages(doc).then(setPages, () => router.back());
  }, [doc]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {pages && (
        <FlatList
          data={pages}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={Math.min(Number(index ?? 0), pages.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p) => p.uri}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <ZoomableImage uri={item.uri} width={width} height={height} onZoomChange={setZoomed} />
            </View>
          )}
        />
      )}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <IconButton icon="close" iconColor="#fff" accessibilityLabel="Close" onPress={() => router.back()} />
        {pages && (
          <Text variant="titleSmall" style={styles.counter}>
            {current + 1} / {pages.length}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  counter: { color: '#fff' },
});
