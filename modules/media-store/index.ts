// Re-export the native module. On web, it will be resolved to MediaStoreModule.web.ts
// and on native platforms to MediaStoreModule.ts
export { default } from './src/MediaStoreModule';
export * from './src/MediaStore.types';
