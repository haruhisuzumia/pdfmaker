import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { List, Snackbar } from 'react-native-paper';

import { pickImages } from '@/scan/scanner';
import { useDraft } from '@/store/draft';

type Tool = {
  title: string;
  description: string;
  icon: string;
  /** Screen to open, or an action to run; neither means "coming soon". */
  href?: Href;
  run?: () => Promise<void>;
};

async function imagesToPdf() {
  const pages = await pickImages();
  if (!pages) return;
  useDraft.getState().startNew(pages);
  router.push('/scan/review');
}

const TOOLS: Tool[] = [
  { title: 'Merge PDFs', description: 'Combine several documents into one', icon: 'file-multiple-outline', href: '/tools/merge' },
  {
    title: 'Split PDF',
    description: 'Copy chosen pages into a new document',
    icon: 'call-split',
    href: { pathname: '/tools/choose', params: { action: 'split' } },
  },
  { title: 'Images to PDF', description: 'Turn photos into a single PDF', icon: 'image-multiple-outline', run: imagesToPdf },
  {
    title: 'PDF to images',
    description: 'Save each page as a JPG in your Gallery',
    icon: 'file-image-outline',
    href: { pathname: '/tools/choose', params: { action: 'images' } },
  },
  { title: 'Compress to size', description: 'Fit portal limits like 100 KB or 200 KB', icon: 'arrow-collapse-vertical' },
  { title: 'Scan ID card', description: 'Front and back on one page', icon: 'card-account-details-outline' },
  { title: 'Passport / exam photo', description: 'Standard sizes at a target KB', icon: 'account-box-outline' },
];

export default function ToolsScreen() {
  const [message, setMessage] = useState<string | null>(null);

  async function open(tool: Tool) {
    try {
      if (tool.href) router.push(tool.href);
      else await tool.run?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        <List.Section>
          {TOOLS.map((tool) => {
            const available = tool.href != null || tool.run != null;
            return (
              <List.Item
                key={tool.title}
                title={tool.title}
                description={available ? tool.description : `${tool.description} · coming soon`}
                disabled={!available}
                onPress={() => open(tool)}
                left={(p) => <List.Icon {...p} icon={tool.icon} />}
                right={available ? (p) => <List.Icon {...p} icon="chevron-right" /> : undefined}
              />
            );
          })}
        </List.Section>
      </ScrollView>
      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}
