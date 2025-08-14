declare module 'gradient-string' {
  interface Gradient {
    (text: string): string;
    multiline(text: string): string;
  }

  interface GradientConstructor {
    (colors: string[]): Gradient;
    rainbow: Gradient;
    cristal: Gradient;
    teen: Gradient;
    mind: Gradient;
    morning: Gradient;
    vice: Gradient;
    passion: Gradient;
    fruit: Gradient;
    instagram: Gradient;
    atlas: Gradient;
    retro: Gradient;
    summer: Gradient;
    pastel: Gradient;
    phase: Gradient;
  }

  const gradient: GradientConstructor;
  export = gradient;
}
