import { useEffect, useRef, useState } from 'react'

type AudioDriver = {
  sourceLabel: string
  level: number
  useMicrophone: boolean
  setMicMode: (next: boolean) => Promise<void>
  selectAudioFile: (file: File) => Promise<void>
}

export function useAudioDriver(): AudioDriver {
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const [sourceLabel, setSourceLabel] = useState('No source')
  const [useMicrophone, setUseMicrophone] = useState(false)
  const [level, setLevel] = useState(0)

  const disconnectSource = () => {
    sourceRef.current?.disconnect()
    sourceRef.current = null

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ''
      audioElRef.current = null
    }
  }

  const ensureAudioGraph = () => {
    if (!contextRef.current) {
      contextRef.current = new AudioContext()
    }
    if (!analyserRef.current) {
      const analyser = contextRef.current.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.85
      analyserRef.current = analyser
    }
  }

  const startReadingLevel = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    const analyser = analyserRef.current
    if (!analyser) {
      return
    }
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i += 1) {
        const centered = (data[i] - 128) / 128
        sum += centered * centered
      }
      const rms = Math.sqrt(sum / data.length)
      setLevel(rms)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const setMicMode = async (next: boolean) => {
    setUseMicrophone(next)
    ensureAudioGraph()
    disconnectSource()

    const context = contextRef.current!
    if (context.state === 'suspended') {
      await context.resume()
    }

    if (next) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const source = context.createMediaStreamSource(stream)
      source.connect(analyserRef.current!)
      sourceRef.current = source
      setSourceLabel('Microphone')
      startReadingLevel()
      return
    }

    setSourceLabel('No source')
    setLevel(0)
  }

  const selectAudioFile = async (file: File) => {
    setUseMicrophone(false)
    ensureAudioGraph()
    disconnectSource()

    const context = contextRef.current!
    if (context.state === 'suspended') {
      await context.resume()
    }

    const audio = new Audio(URL.createObjectURL(file))
    audio.crossOrigin = 'anonymous'
    audio.loop = true
    audio.muted = false
    audio.play().catch(() => undefined)
    audioElRef.current = audio
    const source = context.createMediaElementSource(audio)
    source.connect(analyserRef.current!)
    source.connect(context.destination)
    sourceRef.current = source
    setSourceLabel(`Audio file: ${file.name}`)
    startReadingLevel()
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      disconnectSource()
      contextRef.current?.close().catch(() => undefined)
    }
  }, [])

  return { sourceLabel, level, useMicrophone, setMicMode, selectAudioFile }
}
