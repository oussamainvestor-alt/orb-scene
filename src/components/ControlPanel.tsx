import { useState, type MouseEvent as ReactMouseEvent } from 'react'

type ControlPanelProps = {
  isRecording: boolean
  useMicrophone: boolean
  sourceLabel: string
  videoFileName: string
  audioFileName: string
  recordedUrl: string | null
  recordedFileName: string
  onToggleMic: (next: boolean) => Promise<void>
  onVideoUpload: (file: File | null) => void
  onAudioUpload: (file: File | null) => void
  onCoordinateUpload: (file: File | null) => void
  onCoordinatesDownload: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onClearRecording: () => void
}

export function ControlPanel(props: ControlPanelProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const beginDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    const startX = event.clientX
    const startY = event.clientY
    const initial = { ...offset }

    const onMove = (moveEvent: MouseEvent) => {
      setOffset({
        x: initial.x + (moveEvent.clientX - startX),
        y: initial.y + (moveEvent.clientY - startY),
      })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <aside
      className="control-panel"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div className="panel-drag-handle" onMouseDown={beginDrag}>
        <h2>Environment Controls</h2>
      </div>
      <p className="sub">Source: {props.sourceLabel}</p>

      <label className="field">
        <span>Upload screen video</span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => props.onVideoUpload(event.target.files?.[0] ?? null)}
        />
        <small>{props.videoFileName}</small>
      </label>

      <label className="field">
        <span>Upload voice audio</span>
        <input
          type="file"
          accept="audio/*"
          onChange={(event) => props.onAudioUpload(event.target.files?.[0] ?? null)}
        />
        <small>{props.audioFileName}</small>
      </label>

      <button
        type="button"
        className="btn secondary"
        onClick={() => props.onToggleMic(!props.useMicrophone)}
      >
        {props.useMicrophone ? 'Disable microphone mode' : 'Enable microphone mode'}
      </button>

      <div className="divider" />

      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={props.onStartRecording}
          disabled={props.isRecording}
        >
          Start record
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={props.onStopRecording}
          disabled={!props.isRecording}
        >
          Stop
        </button>
      </div>

      <div className="divider" />

      <div className="row">
        <button type="button" className="btn secondary" onClick={props.onCoordinatesDownload}>
          Download coordinates
        </button>
        <label className="btn secondary upload-btn">
          Upload coordinates
          <input
            type="file"
            accept="application/json"
            onChange={(event) => props.onCoordinateUpload(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {props.recordedUrl && (
        <div className="recording-actions">
          <a className="btn" href={props.recordedUrl} download={props.recordedFileName}>
            Download recording
          </a>
          <button type="button" className="btn danger" onClick={props.onClearRecording}>
            Clear recording
          </button>
        </div>
      )}
    </aside>
  )
}
