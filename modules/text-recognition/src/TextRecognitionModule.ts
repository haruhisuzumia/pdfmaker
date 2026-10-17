import { NativeModule, requireNativeModule } from 'expo';

import type { Script } from './TextRecognition.types';

declare class TextRecognitionModule extends NativeModule<{}> {
  /** Recognizes text in a local image (file:// or content://), on the device. Blocks are separated by blank lines. */
  recognizeAsync(imageUri: string, script: Script): Promise<string>;
}

export default requireNativeModule<TextRecognitionModule>('TextRecognition');
