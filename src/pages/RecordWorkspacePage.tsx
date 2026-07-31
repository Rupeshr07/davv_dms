import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Folder,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Scissors,
  SkipForward,
} from 'lucide-react'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extractDocument, Scanner, type CornerPoints, type Point } from 'scanic'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appApi, getApiErrorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RecordViewerResponse } from '../../shared/types'

type Rotation = 0 | 90 | 180 | 270
type EdgeHandle = 'top' | 'right' | 'bottom' | 'left'
type DragMode = 'move' | keyof CornerPoints | EdgeHandle

type FileDraft = {
  rotation: Rotation
  cropEnabled: boolean
  cropCorners: CornerPoints | null
}

type WorkspaceFile = {
  id: string
  name: string
  extension: string
  relativePath: string
  kind: 'image' | 'pdf'
  handle: FileSystemFileHandle
}

type LoadedAsset = {
  file: File
  kind: 'image' | 'pdf'
  sourceCanvas: HTMLCanvasElement
  rotatedCanvasCache: Map<Rotation, HTMLCanvasElement>
  cropSuggestionCache: Map<Rotation, CornerPoints | null>
}

type PreviewMetrics = {
  left: number
  top: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
}

type DragState = {
  mode: DragMode
  startX: number
  startY: number
  originCorners: CornerPoints
}

type DetectionOutcome = {
  corners: CornerPoints
  source: 'ml' | 'classical' | 'fallback'
}

type DisplayPoint = Point & {
  clientX: number
  clientY: number
}

type WorkspaceDirectoryEntry = FileSystemDirectoryHandle | FileSystemFileHandle
type PermissionMode = 'read' | 'readwrite'
type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?: (descriptor: { mode: PermissionMode }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: PermissionMode }) => Promise<PermissionState>
}
type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterable<[string, WorkspaceDirectoryEntry]>
}

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])
const CORNER_KEYS: Array<keyof CornerPoints> = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']
const EDGE_TO_CORNERS: Record<EdgeHandle, [keyof CornerPoints, keyof CornerPoints]> = {
  top: ['topLeft', 'topRight'],
  right: ['topRight', 'bottomRight'],
  bottom: ['bottomLeft', 'bottomRight'],
  left: ['topLeft', 'bottomLeft'],
}

const defaultDraft = (): FileDraft => ({
  rotation: 0,
  cropEnabled: false,
  cropCorners: null,
})

const defaultPreviewMetrics: PreviewMetrics = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  sourceWidth: 0,
  sourceHeight: 0,
}

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null

const getPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((module) => {
      module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return module
    })
  }

  return pdfJsPromise
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const roundPoint = (point: Point): Point => ({
  x: Math.round(point.x),
  y: Math.round(point.y),
})

const clonePoint = (point: Point): Point => ({
  x: point.x,
  y: point.y,
})

const cloneCorners = (corners: CornerPoints | null): CornerPoints | null =>
  corners
    ? {
        topLeft: clonePoint(corners.topLeft),
        topRight: clonePoint(corners.topRight),
        bottomRight: clonePoint(corners.bottomRight),
        bottomLeft: clonePoint(corners.bottomLeft),
      }
    : null

const roundCorners = (corners: CornerPoints): CornerPoints => ({
  topLeft: roundPoint(corners.topLeft),
  topRight: roundPoint(corners.topRight),
  bottomRight: roundPoint(corners.bottomRight),
  bottomLeft: roundPoint(corners.bottomLeft),
})

const clampPointToBounds = (point: Point, maxWidth: number, maxHeight: number): Point => ({
  x: clamp(point.x, 0, maxWidth),
  y: clamp(point.y, 0, maxHeight),
})

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error('Could not create file output.'))
    }, type, quality)
  })

const disposeCanvas = (canvas: HTMLCanvasElement) => {
  canvas.width = 1
  canvas.height = 1
}

const disposeAsset = (asset: LoadedAsset) => {
  disposeCanvas(asset.sourceCanvas)
  asset.rotatedCanvasCache.forEach((canvas) => disposeCanvas(canvas))
  asset.rotatedCanvasCache.clear()
  asset.cropSuggestionCache.clear()
}

const getFileExtension = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

const isSupportedFile = (name: string) => SUPPORTED_EXTENSIONS.has(getFileExtension(name))

const getFileKind = (extension: string): WorkspaceFile['kind'] =>
  extension === 'pdf' ? 'pdf' : 'image'

const getRotatedDimensions = (width: number, height: number, rotation: Rotation) =>
  rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }

const getFitRect = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight, 1)
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  return {
    left: (targetWidth - width) / 2,
    top: (targetHeight - height) / 2,
    width,
    height,
  }
}

const getFallbackCorners = (width: number, height: number): CornerPoints => {
  const insetX = Math.max(18, width * 0.05)
  const insetY = Math.max(18, height * 0.05)

  return roundCorners({
    topLeft: { x: insetX, y: insetY },
    topRight: { x: width - insetX, y: insetY },
    bottomRight: { x: width - insetX, y: height - insetY },
    bottomLeft: { x: insetX, y: height - insetY },
  })
}

const getDraftKey = (file: WorkspaceFile) => file.id

const hasEdits = (draft: FileDraft) => draft.rotation !== 0 || draft.cropEnabled

const distanceBetween = (first: Point, second: Point) => Math.hypot(second.x - first.x, second.y - first.y)

const getCornerBounds = (corners: CornerPoints) => {
  const points = CORNER_KEYS.map((key) => corners[key])

  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

const getPolygonArea = (corners: CornerPoints) => {
  const points = CORNER_KEYS.map((key) => corners[key])
  let area = 0

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }

  return Math.abs(area) / 2
}

const isConvexQuad = (corners: CornerPoints) => {
  const points = CORNER_KEYS.map((key) => corners[key])
  let sign = 0

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const afterNext = points[(index + 2) % points.length]
    const cross =
      (next.x - current.x) * (afterNext.y - next.y) - (next.y - current.y) * (afterNext.x - next.x)

    if (Math.abs(cross) < 0.001) {
      continue
    }

    const nextSign = Math.sign(cross)
    if (!sign) {
      sign = nextSign
      continue
    }

    if (sign !== nextSign) {
      return false
    }
  }

  return true
}

const isValidCorners = (corners: CornerPoints, maxWidth: number, maxHeight: number) => {
  const minEdge = 28
  const areaThreshold = Math.max(1200, maxWidth * maxHeight * 0.015)

  return (
    isConvexQuad(corners) &&
    getPolygonArea(corners) >= areaThreshold &&
    distanceBetween(corners.topLeft, corners.topRight) >= minEdge &&
    distanceBetween(corners.bottomLeft, corners.bottomRight) >= minEdge &&
    distanceBetween(corners.topLeft, corners.bottomLeft) >= minEdge &&
    distanceBetween(corners.topRight, corners.bottomRight) >= minEdge
  )
}

const translateCornersWithinBounds = (
  corners: CornerPoints,
  deltaX: number,
  deltaY: number,
  maxWidth: number,
  maxHeight: number,
): CornerPoints => {
  const bounds = getCornerBounds(corners)
  const limitedX = clamp(deltaX, -bounds.minX, maxWidth - bounds.maxX)
  const limitedY = clamp(deltaY, -bounds.minY, maxHeight - bounds.maxY)

  return roundCorners({
    topLeft: { x: corners.topLeft.x + limitedX, y: corners.topLeft.y + limitedY },
    topRight: { x: corners.topRight.x + limitedX, y: corners.topRight.y + limitedY },
    bottomRight: { x: corners.bottomRight.x + limitedX, y: corners.bottomRight.y + limitedY },
    bottomLeft: { x: corners.bottomLeft.x + limitedX, y: corners.bottomLeft.y + limitedY },
  })
}

const getOrderedCorners = (points: Point[]): CornerPoints => {
  const remaining = [...points]
  const topLeft = remaining.reduce((best, point) =>
    point.x + point.y < best.x + best.y ? point : best,
  )
  const bottomRight = remaining.reduce((best, point) =>
    point.x + point.y > best.x + best.y ? point : best,
  )
  const topRight = remaining.reduce((best, point) =>
    point.x - point.y > best.x - best.y ? point : best,
  )
  const bottomLeft = remaining.reduce((best, point) =>
    point.x - point.y < best.x - best.y ? point : best,
  )

  return roundCorners({
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
  })
}

const rotateCornersRight = (corners: CornerPoints, width: number, height: number) =>
  getOrderedCorners(
    CORNER_KEYS.map((key) => {
      const point = corners[key]
      return {
        x: height - point.y,
        y: point.x,
      }
    }),
  )

const rotateCornersLeft = (corners: CornerPoints, width: number) =>
  getOrderedCorners(
    CORNER_KEYS.map((key) => {
      const point = corners[key]
      return {
        x: point.y,
        y: width - point.x,
      }
    }),
  )

const getPointForPreview = (point: Point, previewMetrics: PreviewMetrics): DisplayPoint => {
  const scaleX = previewMetrics.width / previewMetrics.sourceWidth
  const scaleY = previewMetrics.height / previewMetrics.sourceHeight
  const x = point.x * scaleX
  const y = point.y * scaleY

  return {
    x,
    y,
    clientX: previewMetrics.left + x,
    clientY: previewMetrics.top + y,
  }
}

const getLongestOppositeEdges = (corners: CornerPoints): EdgeHandle[] => {
  const horizontal =
    (distanceBetween(corners.topLeft, corners.topRight) +
      distanceBetween(corners.bottomLeft, corners.bottomRight)) /
    2
  const vertical =
    (distanceBetween(corners.topLeft, corners.bottomLeft) +
      distanceBetween(corners.topRight, corners.bottomRight)) /
    2

  return horizontal >= vertical ? ['top', 'bottom'] : ['left', 'right']
}

const getEdgeMidpoint = (corners: CornerPoints, edge: EdgeHandle): Point => {
  const [firstKey, secondKey] = EDGE_TO_CORNERS[edge]
  const first = corners[firstKey]
  const second = corners[secondKey]

  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}

const applyDragToCorners = (
  corners: CornerPoints,
  mode: DragMode,
  deltaX: number,
  deltaY: number,
  maxWidth: number,
  maxHeight: number,
): CornerPoints => {
  if (mode === 'move') {
    return translateCornersWithinBounds(corners, deltaX, deltaY, maxWidth, maxHeight)
  }

  if (mode in EDGE_TO_CORNERS) {
    const [firstKey, secondKey] = EDGE_TO_CORNERS[mode]
    const candidate: CornerPoints = cloneCorners(corners) as CornerPoints
    candidate[firstKey] = clampPointToBounds(
      {
        x: corners[firstKey].x + deltaX,
        y: corners[firstKey].y + deltaY,
      },
      maxWidth,
      maxHeight,
    )
    candidate[secondKey] = clampPointToBounds(
      {
        x: corners[secondKey].x + deltaX,
        y: corners[secondKey].y + deltaY,
      },
      maxWidth,
      maxHeight,
    )

    return isValidCorners(candidate, maxWidth, maxHeight) ? roundCorners(candidate) : corners
  }

  const candidate: CornerPoints = cloneCorners(corners) as CornerPoints
  candidate[mode] = clampPointToBounds(
    {
      x: corners[mode].x + deltaX,
      y: corners[mode].y + deltaY,
    },
    maxWidth,
    maxHeight,
  )

  return isValidCorners(candidate, maxWidth, maxHeight) ? roundCorners(candidate) : corners
}

const createImageCanvas = async (file: File) => {
  const bitmap = await createImageBitmap(file)
  const canvas = createCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close()
    throw new Error('Could not prepare image preview.')
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

const createPdfCanvas = async (file: File) => {
  const pdfJs = await getPdfJs()
  const pdf = await pdfJs.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.6 })
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')

  if (!context) {
    page.cleanup()
    throw new Error('Could not prepare PDF preview.')
  }

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise

  page.cleanup()
  return canvas
}

const getRotatedCanvas = (asset: LoadedAsset, rotation: Rotation) => {
  if (rotation === 0) {
    return asset.sourceCanvas
  }

  const cachedCanvas = asset.rotatedCanvasCache.get(rotation)
  if (cachedCanvas) {
    return cachedCanvas
  }

  const { width, height } = getRotatedDimensions(
    asset.sourceCanvas.width,
    asset.sourceCanvas.height,
    rotation,
  )
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  if (!context) {
    return asset.sourceCanvas
  }

  context.save()

  if (rotation === 90) {
    context.translate(width, 0)
    context.rotate(Math.PI / 2)
  } else if (rotation === 180) {
    context.translate(width, height)
    context.rotate(Math.PI)
  } else {
    context.translate(0, height)
    context.rotate(-Math.PI / 2)
  }

  context.drawImage(asset.sourceCanvas, 0, 0)
  context.restore()

  asset.rotatedCanvasCache.set(rotation, canvas)
  return canvas
}

const extractCanvasFromCorners = async (canvas: HTMLCanvasElement, corners: CornerPoints) => {
  const result = await extractDocument(canvas, corners, { output: 'canvas' })

  if (!result.success || !(result.output instanceof HTMLCanvasElement)) {
    throw new Error(result.message || 'Could not crop the detected document.')
  }

  return result.output
}

const getMimeTypeForExtension = (extension: string) => {
  if (extension === 'png') {
    return 'image/png'
  }

  return 'image/jpeg'
}

const ensureReadPermission = async (handle: FileSystemHandle) => {
  const permissionHandle = handle as PermissionCapableHandle

  if (typeof permissionHandle.queryPermission === 'function') {
    const permission = await permissionHandle.queryPermission({ mode: 'read' })
    if (permission === 'granted') {
      return true
    }
  }

  if (typeof permissionHandle.requestPermission === 'function') {
    const permission = await permissionHandle.requestPermission({ mode: 'read' })
    return permission === 'granted'
  }

  return true
}

const ensureWritePermission = async (handle: FileSystemDirectoryHandle) => {
  const permissionHandle = handle as PermissionCapableHandle

  if (typeof permissionHandle.queryPermission === 'function') {
    const permission = await permissionHandle.queryPermission({ mode: 'readwrite' })
    if (permission === 'granted') {
      return true
    }
  }

  if (typeof permissionHandle.requestPermission === 'function') {
    const permission = await permissionHandle.requestPermission({ mode: 'readwrite' })
    return permission === 'granted'
  }

  return true
}

const collectSupportedFiles = async (
  handle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<WorkspaceFile[]> => {
  const files: WorkspaceFile[] = []
  const iterableHandle = handle as IterableDirectoryHandle

  for await (const [entryName, entry] of iterableHandle.entries()) {
    if (entry.kind === 'directory') {
      files.push(...(await collectSupportedFiles(entry, `${prefix}${entryName}/`)))
      continue
    }

    if (!isSupportedFile(entryName)) {
      continue
    }

    const extension = getFileExtension(entryName)
    files.push({
      id: `${prefix}${entryName}`,
      name: entryName,
      extension,
      relativePath: `${prefix}${entryName}`,
      kind: getFileKind(extension),
      handle: entry,
    })
  }

  return files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, { numeric: true }),
  )
}

const ensureOutputDirectory = async (
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ directory: FileSystemDirectoryHandle; fileName: string }> => {
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    throw new Error('Invalid file path.')
  }

  let currentDirectory = root
  for (const segment of segments) {
    currentDirectory = await currentDirectory.getDirectoryHandle(segment, { create: true })
  }

  return { directory: currentDirectory, fileName }
}

const buildPdfFromCanvas = async (canvas: HTMLCanvasElement) => {
  const { PDFDocument } = await import('pdf-lib')
  const pdfDocument = await PDFDocument.create()
  const imageBytes = await canvasToBlob(canvas, 'image/png')
  const embeddedImage = await pdfDocument.embedPng(await imageBytes.arrayBuffer())
  const page = pdfDocument.addPage([canvas.width, canvas.height])

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  })

  return new Blob([await pdfDocument.save()], { type: 'application/pdf' })
}

function CropOverlay({
  cropCorners,
  previewMetrics,
  onStartDrag,
}: {
  cropCorners: CornerPoints
  previewMetrics: PreviewMetrics
  onStartDrag: (mode: DragMode, event: React.PointerEvent<Element>) => void
}) {
  if (!previewMetrics.width || !previewMetrics.height) {
    return null
  }

  const topLeft = getPointForPreview(cropCorners.topLeft, previewMetrics)
  const topRight = getPointForPreview(cropCorners.topRight, previewMetrics)
  const bottomRight = getPointForPreview(cropCorners.bottomRight, previewMetrics)
  const bottomLeft = getPointForPreview(cropCorners.bottomLeft, previewMetrics)
  const polygonPoints = [topLeft, topRight, bottomRight, bottomLeft]
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
  const polygonPathPoints = [topLeft, topRight, bottomRight, bottomLeft]
    .map((point) => `${point.x} ${point.y}`)
    .join(' L ')
  const polygonPath = `M 0 0 H ${previewMetrics.width} V ${previewMetrics.height} H 0 Z M ${polygonPathPoints} Z`
  const cornerHandles = CORNER_KEYS.map((key) => ({
    id: key,
    point: getPointForPreview(cropCorners[key], previewMetrics),
  }))
  const edgeHandles = getLongestOppositeEdges(cropCorners).map((edge) => ({
    id: edge,
    point: getPointForPreview(getEdgeMidpoint(cropCorners, edge), previewMetrics),
  }))

  return (
    <div
      className="pointer-events-none absolute z-10 select-none touch-none"
      style={{
        left: previewMetrics.left,
        top: previewMetrics.top,
        width: previewMetrics.width,
        height: previewMetrics.height,
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${previewMetrics.width} ${previewMetrics.height}`}
      >
        <path d={polygonPath} fill="rgba(15, 23, 42, 0.35)" fillRule="evenodd" />
        <polygon
          points={polygonPoints}
          fill="rgba(59, 130, 246, 0.14)"
          stroke="#2563eb"
          strokeWidth="2.5"
          className="pointer-events-auto cursor-move"
          onPointerDown={(event) => onStartDrag('move', event)}
        />
      </svg>

      {cornerHandles.map((handle) => (
        <button
          key={handle.id}
          type="button"
          aria-label={`Adjust ${handle.id}`}
          className="pointer-events-auto absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow-[0_10px_25px_rgba(37,99,235,0.35)]"
          style={{
            left: handle.point.x,
            top: handle.point.y,
            cursor:
              handle.id === 'topLeft' || handle.id === 'bottomRight'
                ? 'nwse-resize'
                : 'nesw-resize',
          }}
          onPointerDown={(event) => onStartDrag(handle.id, event)}
        />
      ))}

      {edgeHandles.map((handle) => (
        <button
          key={handle.id}
          type="button"
          aria-label={`Adjust ${handle.id} edge`}
          className="pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-[0_10px_25px_rgba(14,165,233,0.35)]"
          style={{
            left: handle.point.x,
            top: handle.point.y,
            cursor: handle.id === 'top' || handle.id === 'bottom' ? 'ns-resize' : 'ew-resize',
          }}
          onPointerDown={(event) => onStartDrag(handle.id, event)}
        />
      ))}
    </div>
  )
}

export default function RecordWorkspacePage() {
  const { recordId = '' } = useParams()
  useDocumentTitle('Document Processing Workspace')

  const [viewerData, setViewerData] = useState<RecordViewerResponse | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(true)
  const [starting, setStarting] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [detectingCrop, setDetectingCrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Select input and output folders to start processing.')
  const [inputDirectory, setInputDirectory] = useState<FileSystemDirectoryHandle | null>(null)
  const [outputDirectory, setOutputDirectory] = useState<FileSystemDirectoryHandle | null>(null)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [currentAsset, setCurrentAsset] = useState<LoadedAsset | null>(null)
  const [currentDraft, setCurrentDraft] = useState<FileDraft>(defaultDraft)
  const [previewMetrics, setPreviewMetrics] = useState<PreviewMetrics>(defaultPreviewMetrics)
  const [previewBounds, setPreviewBounds] = useState({ width: 0, height: 0 })
  const [dragState, setDragState] = useState<DragState | null>(null)

  const previewWrapperRef = useRef<HTMLDivElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const draftsRef = useRef<Map<string, FileDraft>>(new Map())
  const assetCacheRef = useRef<Map<number, LoadedAsset>>(new Map())
  const pendingLoadsRef = useRef<Map<number, Promise<LoadedAsset>>>(new Map())
  const scannerRef = useRef<Scanner | null>(null)
  const cropRequestIdRef = useRef(0)

  const currentFile = workspaceFiles[activeIndex]
  const totalFiles = workspaceFiles.length

  useEffect(() => {
    let active = true

    const loadMetadata = async () => {
      try {
        setLoadingMetadata(true)
        const data = await appApi.getViewer(recordId)

        if (!active) {
          return
        }

        setViewerData(data)
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError))
        }
      } finally {
        if (active) {
          setLoadingMetadata(false)
        }
      }
    }

    void loadMetadata()

    return () => {
      active = false
    }
  }, [recordId])

  useEffect(() => {
    const assetCache = assetCacheRef.current
    const pendingLoads = pendingLoadsRef.current

    return () => {
      assetCache.forEach((asset) => disposeAsset(asset))
      assetCache.clear()
      pendingLoads.clear()
    }
  }, [])

  const getScanner = useCallback(async () => {
    if (!scannerRef.current) {
      scannerRef.current = new Scanner({
        mode: 'detect',
        output: 'canvas',
        maxProcessingDimension: 1400,
      })
      await scannerRef.current.initialize()
    }

    return scannerRef.current
  }, [])

  const setDraftForCurrentFile = useCallback((nextDraft: FileDraft | ((current: FileDraft) => FileDraft)) => {
    setCurrentDraft((current) => {
      const resolvedDraft = typeof nextDraft === 'function' ? nextDraft(current) : nextDraft

      if (currentFile) {
        draftsRef.current.set(getDraftKey(currentFile), {
          rotation: resolvedDraft.rotation,
          cropEnabled: resolvedDraft.cropEnabled,
          cropCorners: cloneCorners(resolvedDraft.cropCorners),
        })
      }

      return resolvedDraft
    })
  }, [currentFile])

  const loadAssetForIndex = useCallback(async (index: number): Promise<LoadedAsset> => {
    const cachedAsset = assetCacheRef.current.get(index)
    if (cachedAsset) {
      return cachedAsset
    }

    const pending = pendingLoadsRef.current.get(index)
    if (pending) {
      return pending
    }

    const fileEntry = workspaceFiles[index]
    if (!fileEntry) {
      throw new Error('File could not be loaded.')
    }

    const loadPromise = (async () => {
      const browserFile = await fileEntry.handle.getFile()
      const sourceCanvas =
        fileEntry.kind === 'pdf' ? await createPdfCanvas(browserFile) : await createImageCanvas(browserFile)

      const asset: LoadedAsset = {
        file: browserFile,
        kind: fileEntry.kind,
        sourceCanvas,
        rotatedCanvasCache: new Map(),
        cropSuggestionCache: new Map(),
      }

      assetCacheRef.current.set(index, asset)
      pendingLoadsRef.current.delete(index)
      return asset
    })()

    pendingLoadsRef.current.set(index, loadPromise)
    return loadPromise
  }, [workspaceFiles])

  const evictAssetCache = useCallback((centerIndex: number) => {
    assetCacheRef.current.forEach((asset, index) => {
      if (index >= centerIndex - 1 && index <= centerIndex + 1) {
        return
      }

      disposeAsset(asset)
      assetCacheRef.current.delete(index)
    })
  }, [])

  const detectCornersWithLibrary = async (canvas: HTMLCanvasElement): Promise<DetectionOutcome> => {
    const fallback = getFallbackCorners(canvas.width, canvas.height)

    try {
      const scanner = await getScanner()

      // Try the ML detector first so hard photos get the stronger model.
      try {
        const mlResult = await scanner.scan(canvas, {
          mode: 'detect',
          detector: 'ml',
          maxProcessingDimension: 1400,
          ml: {
            minScore: 0.45,
          },
        })

        if (mlResult.success && mlResult.corners && isValidCorners(mlResult.corners, canvas.width, canvas.height)) {
          return {
            corners: roundCorners(mlResult.corners),
            source: 'ml',
          }
        }
      } catch {
        // The optional ML assets are lazy-loaded from the CDN, so classical detection stays as a local fallback.
      }

      const classicalResult = await scanner.scan(canvas, {
        mode: 'detect',
        detector: 'classical',
        maxProcessingDimension: 1400,
      })

      if (
        classicalResult.success &&
        classicalResult.corners &&
        isValidCorners(classicalResult.corners, canvas.width, canvas.height)
      ) {
        return {
          corners: roundCorners(classicalResult.corners),
          source: 'classical',
        }
      }
    } catch {
      return {
        corners: fallback,
        source: 'fallback',
      }
    }

    return {
      corners: fallback,
      source: 'fallback',
    }
  }

  const getSuggestedCrop = async (asset: LoadedAsset, rotation: Rotation) => {
    const cachedCorners = asset.cropSuggestionCache.get(rotation)
    if (cachedCorners) {
      return {
        corners: cachedCorners,
        source: 'classical' as DetectionOutcome['source'],
      }
    }

    const orientedCanvas = getRotatedCanvas(asset, rotation)
    const detected = await detectCornersWithLibrary(orientedCanvas)
    asset.cropSuggestionCache.set(rotation, detected.corners)
    return detected
  }

  useEffect(() => {
    if (!workspaceFiles.length) {
      setCurrentAsset(null)
      setCurrentDraft(defaultDraft())
      setDragState(null)
      return
    }

    let active = true

    const loadCurrentAsset = async () => {
      try {
        setPreviewLoading(true)
        const asset = await loadAssetForIndex(activeIndex)
        if (!active) {
          return
        }

        setCurrentAsset(asset)

        const storedDraft = draftsRef.current.get(getDraftKey(workspaceFiles[activeIndex]))
        setCurrentDraft(
          storedDraft
            ? {
                rotation: storedDraft.rotation,
                cropEnabled: storedDraft.cropEnabled,
                cropCorners: cloneCorners(storedDraft.cropCorners),
              }
            : defaultDraft(),
        )

        setStatus(`Ready: ${workspaceFiles[activeIndex].name}`)
        setDragState(null)
        void getScanner().catch(() => undefined)
        void loadAssetForIndex(activeIndex - 1).catch(() => undefined)
        void loadAssetForIndex(activeIndex + 1).catch(() => undefined)
        evictAssetCache(activeIndex)
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError))
          setCurrentAsset(null)
        }
      } finally {
        if (active) {
          setPreviewLoading(false)
        }
      }
    }

    void loadCurrentAsset()

    return () => {
      active = false
    }
  }, [activeIndex, evictAssetCache, getScanner, loadAssetForIndex, workspaceFiles])

  useEffect(() => {
    const wrapper = previewWrapperRef.current
    if (!wrapper) {
      return
    }

    const updateBounds = () => {
      setPreviewBounds({
        width: Math.max(320, Math.floor(wrapper.clientWidth)),
        height: Math.max(460, Math.floor(wrapper.clientHeight)),
      })
    }

    updateBounds()

    const observer = new ResizeObserver(updateBounds)
    observer.observe(wrapper)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const canvas = previewCanvasRef.current
    const wrapper = previewWrapperRef.current

    if (!canvas || !wrapper) {
      return
    }

    const width = previewBounds.width || Math.max(320, Math.floor(wrapper.clientWidth))
    const height = previewBounds.height || Math.max(460, Math.floor(wrapper.clientHeight))
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#f1f5f9'
    context.fillRect(0, 0, width, height)

    if (!currentAsset) {
      setPreviewMetrics(defaultPreviewMetrics)
      return
    }

    const orientedCanvas = getRotatedCanvas(currentAsset, currentDraft.rotation)
    const fitRect = getFitRect(
      orientedCanvas.width,
      orientedCanvas.height,
      Math.max(width - 48, 1),
      Math.max(height - 48, 1),
    )
    const left = fitRect.left + 24
    const top = fitRect.top + 24

    context.fillStyle = '#ffffff'
    context.shadowColor = 'rgba(15, 23, 42, 0.16)'
    context.shadowBlur = 30
    context.shadowOffsetY = 12
    context.fillRect(left, top, fitRect.width, fitRect.height)
    context.shadowColor = 'transparent'
    context.drawImage(orientedCanvas, left, top, fitRect.width, fitRect.height)

    setPreviewMetrics({
      left,
      top,
      width: fitRect.width,
      height: fitRect.height,
      sourceWidth: orientedCanvas.width,
      sourceHeight: orientedCanvas.height,
    })
  }, [currentAsset, currentDraft.rotation, previewBounds])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!previewMetrics.width || !previewMetrics.height) {
        return
      }

      const deltaX = ((event.clientX - dragState.startX) / previewMetrics.width) * previewMetrics.sourceWidth
      const deltaY = ((event.clientY - dragState.startY) / previewMetrics.height) * previewMetrics.sourceHeight
      const nextCorners = applyDragToCorners(
        dragState.originCorners,
        dragState.mode,
        deltaX,
        deltaY,
        previewMetrics.sourceWidth,
        previewMetrics.sourceHeight,
      )

      setDraftForCurrentFile((current) => ({
        ...current,
        cropCorners: cloneCorners(nextCorners),
      }))
    }

    const handlePointerUp = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, previewMetrics, setDraftForCurrentFile])

  const currentFileSummary = useMemo(() => {
    if (!currentFile || !totalFiles) {
      return 'File 0 / 0'
    }

    return `File ${activeIndex + 1} / ${totalFiles}`
  }, [activeIndex, currentFile, totalFiles])

  const pickDirectory = async (mode: 'input' | 'output') => {
    const browserWindow = window as Window & {
      showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
    }

    if (!browserWindow.showDirectoryPicker) {
      setError('This browser does not support folder selection for document processing.')
      return
    }

    try {
      setError('')

      if (mode === 'input') {
        const directory = await browserWindow.showDirectoryPicker({ mode: 'read' })
        setInputDirectory(directory)
        setStatus(`Input folder selected: ${directory.name}`)
        return
      }

      const directory = await browserWindow.showDirectoryPicker({ mode: 'readwrite' })
      setOutputDirectory(directory)
      setStatus(`Output folder selected: ${directory.name}`)
    } catch (selectionError) {
      if (selectionError instanceof Error && selectionError.name === 'AbortError') {
        return
      }

      setError(getApiErrorMessage(selectionError))
    }
  }

  const handleStart = async () => {
    if (!inputDirectory || !outputDirectory) {
      setError('Select both input and output folders before starting.')
      return
    }

    try {
      setStarting(true)
      setError('')

      const [canRead, canWrite] = await Promise.all([
        ensureReadPermission(inputDirectory),
        ensureWritePermission(outputDirectory),
      ])

      if (!canRead || !canWrite) {
        throw new Error('Folder permission was not granted.')
      }

      const files = await collectSupportedFiles(inputDirectory)
      if (!files.length) {
        throw new Error('No supported files were found in the selected input folder.')
      }

      draftsRef.current.clear()
      assetCacheRef.current.forEach((asset) => disposeAsset(asset))
      assetCacheRef.current.clear()
      pendingLoadsRef.current.clear()

      setWorkspaceFiles(files)
      setActiveIndex(0)
      setStatus(`${files.length} supported files loaded from ${inputDirectory.name}.`)
    } catch (startError) {
      setError(getApiErrorMessage(startError))
    } finally {
      setStarting(false)
    }
  }

  const goToNext = () => {
    setActiveIndex((current) => {
      if (current >= workspaceFiles.length - 1) {
        setStatus('All files processed.')
        return current
      }

      return current + 1
    })
  }

  const handlePrevious = () => {
    if (!workspaceFiles.length) {
      return
    }

    setActiveIndex((current) => Math.max(0, current - 1))
  }

  const handleSkip = () => {
    if (!workspaceFiles.length) {
      return
    }

    setStatus(`Skipped: ${currentFile?.name ?? ''}`)
    goToNext()
  }

  const saveCurrentFile = async () => {
    if (!currentFile || !currentAsset || !outputDirectory) {
      return
    }

    const { directory, fileName } = await ensureOutputDirectory(outputDirectory, currentFile.relativePath)
    const fileHandle = await directory.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()

    try {
      if (!hasEdits(currentDraft)) {
        await writable.write(await currentAsset.file.arrayBuffer())
        return
      }

      const rotatedCanvas = getRotatedCanvas(currentAsset, currentDraft.rotation)
      const processedCanvas =
        currentDraft.cropEnabled && currentDraft.cropCorners
          ? await extractCanvasFromCorners(rotatedCanvas, currentDraft.cropCorners)
          : rotatedCanvas

      const outputBlob =
        currentFile.kind === 'pdf'
          ? await buildPdfFromCanvas(processedCanvas)
          : await canvasToBlob(
              processedCanvas,
              getMimeTypeForExtension(currentFile.extension),
              currentFile.extension === 'png' ? undefined : 0.92,
            )

      await writable.write(outputBlob)

      if (processedCanvas !== rotatedCanvas) {
        disposeCanvas(processedCanvas)
      }
    } finally {
      await writable.close()
    }
  }

  const handleNext = async () => {
    if (!currentFile || !outputDirectory) {
      setError('Select an output folder before saving the next file.')
      return
    }

    try {
      setSaving(true)
      setError('')
      await saveCurrentFile()
      setStatus(`Saved: ${currentFile.name}`)
      goToNext()
    } catch (saveError) {
      setError(getApiErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const handleCropToggle = async () => {
    if (!currentAsset) {
      return
    }

    if (currentDraft.cropEnabled) {
      setDraftForCurrentFile((current) => ({
        ...current,
        cropEnabled: false,
      }))
      setStatus('Crop overlay hidden.')
      return
    }

    if (currentDraft.cropCorners) {
      setDraftForCurrentFile((current) => ({
        ...current,
        cropEnabled: true,
      }))
      setStatus('Crop overlay ready.')
      return
    }

    const requestId = ++cropRequestIdRef.current

    try {
      setDetectingCrop(true)
      setError('')
      setStatus('Detecting document borders...')

      const detected = await getSuggestedCrop(currentAsset, currentDraft.rotation)
      if (requestId !== cropRequestIdRef.current) {
        return
      }

      setDraftForCurrentFile((current) => ({
        ...current,
        cropEnabled: true,
        cropCorners: cloneCorners(detected.corners),
      }))

      setStatus(
        detected.source === 'ml'
          ? 'AI crop detected. Adjust the corner points if needed.'
          : detected.source === 'classical'
            ? 'Auto crop detected. Adjust the corner points if needed.'
            : 'Document border was not clear enough, so a manual crop frame was prepared.',
      )
    } catch (cropError) {
      if (requestId !== cropRequestIdRef.current) {
        return
      }

      const fallback = getFallbackCorners(previewMetrics.sourceWidth || 1200, previewMetrics.sourceHeight || 1600)
      setDraftForCurrentFile((current) => ({
        ...current,
        cropEnabled: true,
        cropCorners: fallback,
      }))
      setError(getApiErrorMessage(cropError))
      setStatus('Auto detection had an issue, but manual crop points are ready.')
    } finally {
      if (requestId === cropRequestIdRef.current) {
        setDetectingCrop(false)
      }
    }
  }

  const rotateDraft = (direction: 'left' | 'right') => {
    if (!currentAsset) {
      return
    }

    setDraftForCurrentFile((current) => {
      const nextRotation = (((current.rotation + (direction === 'right' ? 90 : 270)) % 360) || 0) as Rotation

      if (!current.cropCorners) {
        return {
          ...current,
          rotation: nextRotation,
        }
      }

      const { width, height } = getRotatedDimensions(
        currentAsset.sourceCanvas.width,
        currentAsset.sourceCanvas.height,
        current.rotation,
      )
      const rotatedCorners =
        direction === 'right'
          ? rotateCornersRight(current.cropCorners, width, height)
          : rotateCornersLeft(current.cropCorners, width)

      const nextDimensions = getRotatedDimensions(
        currentAsset.sourceCanvas.width,
        currentAsset.sourceCanvas.height,
        nextRotation,
      )
      const normalizedCorners = isValidCorners(rotatedCorners, nextDimensions.width, nextDimensions.height)
        ? rotatedCorners
        : getFallbackCorners(nextDimensions.width, nextDimensions.height)

      return {
        ...current,
        rotation: nextRotation,
        cropCorners: normalizedCorners,
      }
    })
  }

  const startDrag = (mode: DragMode, event: React.PointerEvent<Element>) => {
    if (!currentDraft.cropCorners) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    setDragState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originCorners: cloneCorners(currentDraft.cropCorners) as CornerPoints,
    })
  }

  if (loadingMetadata) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 rounded-[28px] bg-white/70" />
        <div className="h-[760px] rounded-[32px] bg-white/70" />
      </div>
    )
  }

  if (error && !viewerData) {
    return <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Back to Dashboard
        </Link>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              Reference No: {viewerData?.record.referenceNumber ?? '-'}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="font-semibold text-slate-900">Branch:</span> {viewerData?.record.branchName ?? '-'}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="font-semibold text-slate-900">Subject:</span> {viewerData?.record.subjectName ?? '-'}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="font-semibold text-slate-900">Date:</span>{' '}
              {viewerData ? formatDate(viewerData.record.recordDate) : '-'}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-slate-900">Remark:</span> {viewerData?.record.remark || '-'}
            </span>
          </div>
        </div>

        <div className="grid xl:grid-cols-[260px_minmax(0,1fr)_260px]">
          <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b border-slate-200 px-5 py-5">
              <h2 className="text-2xl font-semibold text-slate-900">Folders</h2>
            </div>

            <div className="space-y-8 px-5 py-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Input Folder</h3>
                <button
                  type="button"
                  onClick={() => void pickDirectory('input')}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Folder className="h-5 w-5 text-amber-500" />
                  Choose Folder
                </button>
                <p className="break-all text-sm text-slate-500">
                  {inputDirectory ? inputDirectory.name : 'No input folder selected.'}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Output Folder</h3>
                  <button
                    type="button"
                    onClick={() => void pickDirectory('output')}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Folder className="h-5 w-5 text-amber-500" />
                    Choose Folder
                  </button>
                  <p className="break-all text-sm text-slate-500">
                    {outputDirectory ? outputDirectory.name : 'No output folder selected.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={starting || !inputDirectory || !outputDirectory}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#032760] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#042049] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {starting ? 'Starting...' : 'Start'}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Supported: `pdf`, `jpg`, `jpeg`, `png`
              </div>
            </div>
          </aside>

          <div className="border-b border-slate-200 bg-slate-100 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 text-sm font-medium text-slate-700">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{currentFile?.name ?? 'No file loaded'}</p>
                <p className="text-xs text-slate-500">{currentFileSummary}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {currentFile?.kind === 'pdf' ? 'PDF' : currentFile?.extension?.toUpperCase() ?? 'Idle'}
              </div>
            </div>

            <div ref={previewWrapperRef} className="relative min-h-[760px] overflow-hidden">
              <canvas ref={previewCanvasRef} className="block h-full w-full rounded-[28px]" />

              {previewLoading || detectingCrop ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80">
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {previewLoading ? 'Loading preview...' : 'Detecting document...'}
                  </div>
                </div>
              ) : null}

              {!workspaceFiles.length && !previewLoading ? (
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/90 px-8 py-10 text-center">
                    <h3 className="text-lg font-semibold text-slate-900">Document Processing Workspace</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Select an input folder, select an output folder, and click Start to load one file at a time.
                    </p>
                  </div>
                </div>
              ) : null}

              {currentDraft.cropEnabled && currentDraft.cropCorners ? (
                <CropOverlay cropCorners={currentDraft.cropCorners} previewMetrics={previewMetrics} onStartDrag={startDrag} />
              ) : null}
            </div>
          </div>

          <aside className="px-5 py-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Navigation</h2>
              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={!workspaceFiles.length || activeIndex === 0 || saving || detectingCrop}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  disabled={!workspaceFiles.length || !outputDirectory || saving || previewLoading || detectingCrop}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#032760] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#042049] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Next'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={!workspaceFiles.length || saving || detectingCrop}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </button>
              </div>
            </div>

            <div className="mt-12">
              <h2 className="text-2xl font-semibold text-slate-900">Tools</h2>
              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={() => void handleCropToggle()}
                  disabled={!currentAsset || saving || previewLoading || detectingCrop}
                  className={cn(
                    'flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                    currentDraft.cropEnabled
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {detectingCrop ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                  {detectingCrop ? 'Detecting...' : currentDraft.cropEnabled ? 'Disable Crop' : 'Crop Document'}
                </button>
                <button
                  type="button"
                  onClick={() => rotateDraft('left')}
                  disabled={!currentAsset || saving || previewLoading || detectingCrop}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Rotate Left
                </button>
                <button
                  type="button"
                  onClick={() => rotateDraft('right')}
                  disabled={!currentAsset || saving || previewLoading || detectingCrop}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCw className="h-4 w-4" />
                  Rotate Right
                </button>
              </div>
            </div>

            <div className="mt-12 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {status}
              </div>
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
