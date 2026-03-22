import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import VisualizerPage from './pages/VisualizerPage'
import './App.css'

function LandingRoute() {
  const navigate = useNavigate()
  return <LandingPage onEnter={() => navigate('/visualizer')} />
}

function VisualizerRoute() {
  const navigate = useNavigate()
  return <VisualizerPage onBack={() => navigate('/')} />
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/visualizer" element={<VisualizerRoute />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
