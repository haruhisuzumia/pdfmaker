import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BottomNavigation } from 'react-native-paper';

/**
 * Material 3 bottom bar (animated pill indicator, ripple) driving the router's tabs.
 * Keeps the default tab behaviour: tabPress events and no-op on the focused tab.
 */
export function MaterialTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <BottomNavigation.Bar
      navigationState={state}
      safeAreaInsets={insets}
      shifting={false}
      onTabPress={({ route, preventDefault }) => {
        const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (event.defaultPrevented) {
          preventDefault();
        } else if (state.routes[state.index].key !== route.key) {
          navigateToTab(route.key);
        }
      }}
      onTabLongPress={({ route }) => emitter.emit({ type: 'tabLongPress', target: route.key })}
      renderIcon={({ route, focused, color }) =>
        descriptors[route.key].options.tabBarIcon?.({ focused, color, size: 24 }) ?? null
      }
      getLabelText={({ route }) => descriptors[route.key].options.title ?? route.name}
    />
  );
}
