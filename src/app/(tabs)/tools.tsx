import { ScrollView } from 'react-native';
import { List } from 'react-native-paper';

// Each tool gets its own screen in milestones 3–5; listed now so the layout is settled.
const TOOLS = [
  { title: 'Merge PDFs', description: 'Combine several documents into one', icon: 'file-multiple-outline' },
  { title: 'Split PDF', description: 'Pull pages out into a new document', icon: 'call-split' },
  { title: 'Compress to size', description: 'Fit portal limits like 100 KB or 200 KB', icon: 'arrow-collapse-vertical' },
  { title: 'Images to PDF', description: 'Turn photos into a single PDF', icon: 'image-multiple-outline' },
  { title: 'PDF to images', description: 'Save each page as a JPG', icon: 'file-image-outline' },
  { title: 'Scan ID card', description: 'Front and back on one page', icon: 'card-account-details-outline' },
  { title: 'Passport / exam photo', description: 'Standard sizes at a target KB', icon: 'account-box-outline' },
];

export default function ToolsScreen() {
  return (
    <ScrollView>
      <List.Section>
        {TOOLS.map((tool) => (
          <List.Item
            key={tool.title}
            title={tool.title}
            description={`${tool.description} · coming soon`}
            disabled
            left={(p) => <List.Icon {...p} icon={tool.icon} />}
          />
        ))}
      </List.Section>
    </ScrollView>
  );
}
