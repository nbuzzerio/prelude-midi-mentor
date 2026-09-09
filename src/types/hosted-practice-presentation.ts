/** Presentation intent supplied by the stable Practice Session host. */
export type HostedPracticePresentation = Readonly<{
  isFocusMode: boolean;
  isMobilePlayMode: boolean;
  showVirtualKeyboard: boolean;
}>;
