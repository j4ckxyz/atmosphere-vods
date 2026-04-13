import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'

const BrowsePage = lazy(() => import('@/pages/browse-page').then((module) => ({ default: module.BrowsePage })))
const SearchPage = lazy(() => import('@/pages/search-page').then((module) => ({ default: module.SearchPage })))
const AboutPage = lazy(() => import('@/pages/about-page').then((module) => ({ default: module.AboutPage })))
const VideoPage = lazy(() => import('@/pages/video-page').then((module) => ({ default: module.VideoPage })))
const TagPage = lazy(() => import('@/pages/tag-page').then((module) => ({ default: module.TagPage })))

function RouteFallback() {
  return (
    <section className="rounded-lg border border-line/45 bg-surface/80 p-5">
      <p className="text-sm text-muted">Loading view...</p>
    </section>
  )
}

function App() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/video/:encodedUri" element={<VideoPage />} />
          <Route path="/tag/:tagParam" element={<TagPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

export default App
