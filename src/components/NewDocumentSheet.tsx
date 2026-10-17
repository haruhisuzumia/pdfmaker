import { StyleSheet } from 'react-native';
import { List, Modal, Portal, Text, useTheme } from 'react-native-paper';

export type NewDocumentAction = 'scan' | 'id-card' | 'photos' | 'pdf';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (action: NewDocumentAction) => void;
};

// ID card mode and photo import arrive in later milestones.
const COMING_SOON = 'Coming in the next update';

export function NewDocumentSheet({ visible, onDismiss, onSelect }: Props) {
  const theme = useTheme();
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.elevation.level2 }]}
        style={styles.modal}>
        <Text variant="titleMedium" style={styles.title}>
          New document
        </Text>
        <List.Item
          title="Scan document"
          description="Finds the page edges and straightens it"
          onPress={() => onSelect('scan')}
          left={(p) => <List.Icon {...p} icon="camera-outline" />}
        />
        <List.Item
          title="Scan ID card"
          description={COMING_SOON}
          disabled
          left={(p) => <List.Icon {...p} icon="card-account-details-outline" />}
        />
        <List.Item
          title="Import photos"
          description={COMING_SOON}
          disabled
          left={(p) => <List.Icon {...p} icon="image-multiple-outline" />}
        />
        <List.Item
          title="Import PDF"
          description="From your phone or Google Drive"
          onPress={() => onSelect('pdf')}
          left={(p) => <List.Icon {...p} icon="file-import-outline" />}
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingBottom: 32 },
  title: { paddingHorizontal: 24, paddingBottom: 8 },
});
