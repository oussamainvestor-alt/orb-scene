import { useState } from 'react'

type RecorderState = {
  isRecording: boolean
  recordedUrl: string | null
  recordedFileName: string
  setCanvas: (canvas: HTMLCanvasElement | null) => void
  startRecording: () => void
  stopRecording: () => void
  clearRecording: () => void
}

export function useRecorder(): RecorderState {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedFileName, setRecordedFileName] = useState('environment-recording.webm')

  const startRecording = () => {
    if (!canvas || isRecording) {
      return
    }

    const stream = canvas.captureStream(60)
    const chunks: BlobPart[] = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const nextRecorder = new MediaRecorder(stream, { mimeType })

    nextRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    nextRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      setRecordedUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous)
        }
        return url
      })
      setRecordedFileName(`environment-recording-${Date.now()}.webm`)
      stream.getTracks().forEach((track) => track.stop())
    }

    nextRecorder.start()
    setRecorder(nextRecorder)
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (!recorder || recorder.state !== 'recording') {
      return
    }
    recorder.stop()
    setIsRecording(false)
    setRecorder(null)
  }

  const clearRecording = () => {
    setRecordedUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return null
    })
  }

  return {
    isRecording,
    recordedUrl,
    recordedFileName,
    setCanvas,
    startRecording,
    stopRecording,
    clearRecording,
  }
}
