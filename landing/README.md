# 🚀 Embedocs Landing Page

A stunning, ultra-modern landing page for Embedocs - AI That Actually Knows Your Docs.

## ✨ Features

- **Mind-blowing Design**: Dark theme with neon accents, glassmorphism, and particle effects
- **Interactive Demos**: Live terminal comparisons showing before/after Embedocs
- **Smooth Animations**: Framer Motion powered animations and transitions
- **Code Highlighting**: Beautiful syntax highlighting with copy functionality
- **Responsive**: Perfectly optimized for all screen sizes
- **Performance**: Optimized Next.js 14 with App Router

## 🎨 Design Philosophy

- **Developer-First**: Speaks the language of developers with terminal UIs and code blocks
- **Visual Impact**: Gradient animations, particle effects, and glow effects
- **Clear Value Prop**: Immediately shows the problem and solution
- **Modern Stack**: Built with cutting-edge web technologies

## 🛠️ Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with custom animations
- **Framer Motion**: Smooth, performant animations
- **React Three Fiber**: 3D effects and visualizations
- **Lucide Icons**: Beautiful, consistent icons

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🚀 Deployment

### Replit

1. Upload the entire `mongodocs_mcp` repository to Replit
2. The `.replit` configuration will automatically:
   - Navigate to the landing directory
   - Install dependencies
   - Build the Next.js app
   - Start the production server on port 3000

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd landing
vercel
```

### Manual Deployment

```bash
# Build the application
cd landing
npm run build

# The output will be in .next directory
# Serve with any Node.js hosting provider
npm start
```

## 🎯 Key Sections

1. **Hero**: Animated title with live terminal demos
2. **Problem**: The documentation hell developers face
3. **Solution**: Semantic search that understands meaning
4. **How It Works**: 60-second setup process
5. **Stats**: Impressive performance metrics
6. **CTA**: Strong call-to-action with multiple entry points

## 🌟 Special Effects

- **Particle Network**: Animated background particles with connections
- **Gradient Animations**: Shifting color gradients throughout
- **Glow Effects**: Neon glows on hover and focus
- **Glass Morphism**: Frosted glass effect on cards
- **Terminal Animations**: Typewriter effect in terminal demos
- **Smooth Scrolling**: Parallax effects and fade transitions

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px

## 🔧 Environment Variables

No environment variables required for the landing page. It's a static site that can be deployed anywhere.

## 🎨 Customization

### Colors

Edit `tailwind.config.js` to change the color scheme:

```javascript
colors: {
  primary: "#00D9FF",    // Cyan
  secondary: "#7C3AED",  // Purple
  accent: {
    green: "#10B981",
    yellow: "#F59E0B",
    red: "#EF4444",
  }
}
```

### Animations

Custom animations are defined in `tailwind.config.js` and can be modified or extended.

## 📈 Performance

- Lighthouse Score: 95+
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Optimized images and fonts
- Code splitting and lazy loading

## 🤝 Contributing

Feel free to submit PRs to improve the landing page design or functionality!

---

Built with 💙 for the Embedocs project