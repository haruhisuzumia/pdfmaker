import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTheme } from 'react-native-paper';

import { MaterialTabBar } from '@/components/MaterialTabBar';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Outline icon normally, filled when the tab is selected (Material 3). */
function tabIcon(outline: IconName, filled: IconName) {
  function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <MaterialCommunityIcons name={focused ? filled : outline} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      tabBar={(props) => <MaterialTabBar {...props} />}
      screenOptions={{
        // Slide-and-fade between tabs instead of an instant swap.
        animation: 'shift',
        headerStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Documents', tabBarIcon: tabIcon('file-document-multiple-outline', 'file-document-multiple') }}
      />
      <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: tabIcon('toolbox-outline', 'toolbox') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('cog-outline', 'cog') }} />
    </Tabs>
  );
}
