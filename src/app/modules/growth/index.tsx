import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { MeasurementRecord } from '../../../types/growth';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { AppDatePicker } from '../../../components/ui/AppDatePicker';

// ─── WHO Growth Standards Data ────────────────────────────────────────────────

type PercentileRow = { age: number; p3: number; p15: number; p50: number; p85: number; p97: number };

const WHO_WEIGHT_BOYS: PercentileRow[] = [
  { age: 0,  p3: 2.5,  p15: 2.9,  p50: 3.3,  p85: 3.9,  p97: 4.3  },
  { age: 1,  p3: 3.4,  p15: 3.9,  p50: 4.5,  p85: 5.1,  p97: 5.7  },
  { age: 2,  p3: 4.3,  p15: 4.9,  p50: 5.6,  p85: 6.3,  p97: 7.1  },
  { age: 3,  p3: 5.0,  p15: 5.7,  p50: 6.4,  p85: 7.2,  p97: 8.0  },
  { age: 4,  p3: 5.6,  p15: 6.2,  p50: 7.0,  p85: 7.8,  p97: 8.7  },
  { age: 5,  p3: 6.0,  p15: 6.7,  p50: 7.5,  p85: 8.4,  p97: 9.3  },
  { age: 6,  p3: 6.4,  p15: 7.1,  p50: 7.9,  p85: 8.8,  p97: 9.8  },
  { age: 7,  p3: 6.7,  p15: 7.4,  p50: 8.3,  p85: 9.2,  p97: 10.3 },
  { age: 8,  p3: 6.9,  p15: 7.7,  p50: 8.6,  p85: 9.6,  p97: 10.7 },
  { age: 9,  p3: 7.1,  p15: 7.9,  p50: 8.9,  p85: 9.9,  p97: 11.0 },
  { age: 10, p3: 7.4,  p15: 8.2,  p50: 9.2,  p85: 10.2, p97: 11.4 },
  { age: 11, p3: 7.6,  p15: 8.4,  p50: 9.4,  p85: 10.5, p97: 11.7 },
  { age: 12, p3: 7.7,  p15: 8.6,  p50: 9.6,  p85: 10.8, p97: 12.0 },
  { age: 15, p3: 8.3,  p15: 9.2,  p50: 10.3, p85: 11.5, p97: 12.8 },
  { age: 18, p3: 8.8,  p15: 9.8,  p50: 11.0, p85: 12.3, p97: 13.7 },
  { age: 21, p3: 9.2,  p15: 10.3, p50: 11.5, p85: 12.9, p97: 14.4 },
  { age: 24, p3: 9.7,  p15: 10.8, p50: 12.2, p85: 13.6, p97: 15.3 },
];

const WHO_WEIGHT_GIRLS: PercentileRow[] = [
  { age: 0,  p3: 2.4,  p15: 2.8,  p50: 3.2,  p85: 3.7,  p97: 4.2  },
  { age: 1,  p3: 3.2,  p15: 3.6,  p50: 4.2,  p85: 4.8,  p97: 5.5  },
  { age: 2,  p3: 3.9,  p15: 4.5,  p50: 5.1,  p85: 5.8,  p97: 6.6  },
  { age: 3,  p3: 4.5,  p15: 5.2,  p50: 5.8,  p85: 6.6,  p97: 7.5  },
  { age: 4,  p3: 5.0,  p15: 5.7,  p50: 6.4,  p85: 7.3,  p97: 8.2  },
  { age: 5,  p3: 5.4,  p15: 6.1,  p50: 6.9,  p85: 7.8,  p97: 8.8  },
  { age: 6,  p3: 5.7,  p15: 6.5,  p50: 7.3,  p85: 8.2,  p97: 9.3  },
  { age: 7,  p3: 6.0,  p15: 6.8,  p50: 7.6,  p85: 8.6,  p97: 9.8  },
  { age: 8,  p3: 6.3,  p15: 7.0,  p50: 7.9,  p85: 9.0,  p97: 10.2 },
  { age: 9,  p3: 6.5,  p15: 7.3,  p50: 8.2,  p85: 9.3,  p97: 10.5 },
  { age: 10, p3: 6.7,  p15: 7.5,  p50: 8.5,  p85: 9.6,  p97: 10.9 },
  { age: 11, p3: 6.9,  p15: 7.7,  p50: 8.7,  p85: 9.9,  p97: 11.2 },
  { age: 12, p3: 7.0,  p15: 7.9,  p50: 8.9,  p85: 10.1, p97: 11.5 },
  { age: 15, p3: 7.6,  p15: 8.5,  p50: 9.6,  p85: 10.9, p97: 12.4 },
  { age: 18, p3: 8.1,  p15: 9.1,  p50: 10.2, p85: 11.6, p97: 13.2 },
  { age: 21, p3: 8.6,  p15: 9.6,  p50: 10.9, p85: 12.4, p97: 14.0 },
  { age: 24, p3: 9.0,  p15: 10.2, p50: 11.5, p85: 13.1, p97: 14.9 },
];

const WHO_HEIGHT_BOYS: PercentileRow[] = [
  { age: 0,  p3: 46.1, p15: 47.9, p50: 49.9, p85: 51.8, p97: 53.4 },
  { age: 1,  p3: 50.8, p15: 52.8, p50: 54.7, p85: 56.7, p97: 58.4 },
  { age: 2,  p3: 54.4, p15: 56.4, p50: 58.4, p85: 60.4, p97: 62.2 },
  { age: 3,  p3: 57.3, p15: 59.4, p50: 61.4, p85: 63.5, p97: 65.5 },
  { age: 4,  p3: 59.7, p15: 61.8, p50: 63.9, p85: 66.0, p97: 68.0 },
  { age: 5,  p3: 61.7, p15: 63.8, p50: 65.9, p85: 68.0, p97: 70.1 },
  { age: 6,  p3: 63.3, p15: 65.5, p50: 67.6, p85: 69.8, p97: 71.9 },
  { age: 7,  p3: 64.8, p15: 67.0, p50: 69.2, p85: 71.3, p97: 73.5 },
  { age: 8,  p3: 66.2, p15: 68.4, p50: 70.6, p85: 72.9, p97: 75.0 },
  { age: 9,  p3: 67.5, p15: 69.7, p50: 72.0, p85: 74.3, p97: 76.5 },
  { age: 10, p3: 68.7, p15: 71.0, p50: 73.3, p85: 75.6, p97: 77.9 },
  { age: 11, p3: 69.9, p15: 72.2, p50: 74.5, p85: 76.9, p97: 79.2 },
  { age: 12, p3: 71.0, p15: 73.4, p50: 75.7, p85: 78.1, p97: 80.5 },
  { age: 15, p3: 73.9, p15: 76.4, p50: 79.1, p85: 81.7, p97: 84.3 },
  { age: 18, p3: 76.9, p15: 79.6, p50: 82.3, p85: 85.1, p97: 87.7 },
  { age: 21, p3: 79.4, p15: 82.3, p50: 85.1, p85: 88.1, p97: 91.0 },
  { age: 24, p3: 81.7, p15: 84.8, p50: 87.8, p85: 90.9, p97: 93.9 },
];

const WHO_HEIGHT_GIRLS: PercentileRow[] = [
  { age: 0,  p3: 45.6, p15: 47.3, p50: 49.1, p85: 51.0, p97: 52.7 },
  { age: 1,  p3: 49.8, p15: 51.7, p50: 53.7, p85: 55.6, p97: 57.4 },
  { age: 2,  p3: 53.0, p15: 55.0, p50: 57.1, p85: 59.1, p97: 61.1 },
  { age: 3,  p3: 55.6, p15: 57.7, p50: 59.8, p85: 61.9, p97: 64.0 },
  { age: 4,  p3: 57.8, p15: 59.9, p50: 62.1, p85: 64.3, p97: 66.4 },
  { age: 5,  p3: 59.6, p15: 61.8, p50: 64.0, p85: 66.2, p97: 68.5 },
  { age: 6,  p3: 61.2, p15: 63.5, p50: 65.7, p85: 68.0, p97: 70.3 },
  { age: 7,  p3: 62.7, p15: 65.0, p50: 67.3, p85: 69.6, p97: 72.0 },
  { age: 8,  p3: 64.0, p15: 66.4, p50: 68.7, p85: 71.2, p97: 73.5 },
  { age: 9,  p3: 65.3, p15: 67.7, p50: 70.1, p85: 72.6, p97: 75.0 },
  { age: 10, p3: 66.5, p15: 68.9, p50: 71.5, p85: 74.0, p97: 76.4 },
  { age: 11, p3: 67.7, p15: 70.2, p50: 72.8, p85: 75.3, p97: 77.8 },
  { age: 12, p3: 68.9, p15: 71.4, p50: 74.0, p85: 76.6, p97: 79.2 },
  { age: 15, p3: 72.0, p15: 74.8, p50: 77.5, p85: 80.2, p97: 83.0 },
  { age: 18, p3: 74.9, p15: 77.8, p50: 80.7, p85: 83.7, p97: 86.6 },
  { age: 21, p3: 77.5, p15: 80.6, p50: 83.7, p85: 86.8, p97: 90.0 },
  { age: 24, p3: 80.0, p15: 83.2, p50: 86.4, p85: 89.7, p97: 93.0 },
];

const WHO_HEAD: PercentileRow[] = [
  { age: 0,  p3: 32.1, p15: 33.2, p50: 34.5, p85: 35.7, p97: 36.9 },
  { age: 1,  p3: 35.1, p15: 36.1, p50: 37.3, p85: 38.4, p97: 39.5 },
  { age: 2,  p3: 37.0, p15: 38.0, p50: 39.1, p85: 40.2, p97: 41.3 },
  { age: 3,  p3: 38.3, p15: 39.4, p50: 40.5, p85: 41.7, p97: 42.7 },
  { age: 6,  p3: 41.0, p15: 42.0, p50: 43.3, p85: 44.5, p97: 45.5 },
  { age: 9,  p3: 43.0, p15: 44.0, p50: 45.3, p85: 46.4, p97: 47.4 },
  { age: 12, p3: 44.5, p15: 45.5, p50: 46.8, p85: 47.9, p97: 49.0 },
  { age: 18, p3: 46.2, p15: 47.2, p50: 48.4, p85: 49.6, p97: 50.6 },
  { age: 24, p3: 47.2, p15: 48.3, p50: 49.5, p85: 50.6, p97: 51.7 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricTab = 'weight' | 'height' | 'head';

interface PercentileResult {
  value: number; // 0-100
  label: string;
  color: string;
  bg: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linearly interpolate WHO data to any age in months */
function interpolateWHO(data: PercentileRow[], ageMonths: number): PercentileRow | null {
  if (data.length === 0) return null;
  if (ageMonths <= data[0].age) return data[0];
  if (ageMonths >= data[data.length - 1].age) return data[data.length - 1];
  for (let i = 0; i < data.length - 1; i++) {
    if (ageMonths >= data[i].age && ageMonths <= data[i + 1].age) {
      const t = (ageMonths - data[i].age) / (data[i + 1].age - data[i].age);
      return {
        age: ageMonths,
        p3:  lerp(data[i].p3,  data[i + 1].p3,  t),
        p15: lerp(data[i].p15, data[i + 1].p15, t),
        p50: lerp(data[i].p50, data[i + 1].p50, t),
        p85: lerp(data[i].p85, data[i + 1].p85, t),
        p97: lerp(data[i].p97, data[i + 1].p97, t),
      };
    }
  }
  return null;
}

/** Returns a 0-100 percentile estimate by interpolating between known percentile bands */
function estimatePercentile(value: number, row: PercentileRow): number {
  const bands: Array<[number, number, number]> = [
    [0,   row.p3,  3 ],
    [3,   row.p15, 15],
    [15,  row.p50, 50],
    [50,  row.p85, 85],
    [85,  row.p97, 97],
    [97,  row.p97 * 1.15, 99.9],
  ];
  if (value <= row.p3) return Math.max(0, lerp(0, 3, (value - row.p3 * 0.7) / (row.p3 * 0.3)));
  if (value >= row.p97) return 97;
  for (const [pLow, vLow, pctLow] of bands) {
    const nextBand = bands[bands.indexOf(bands.find(b => b[0] === pLow)!) + 1];
    if (!nextBand) break;
    const [, vHigh, pctHigh] = nextBand;
    if (value >= vLow && value <= vHigh) {
      const t = (value - vLow) / (vHigh - vLow);
      return lerp(pctLow, pctHigh, t);
    }
  }
  return 50;
}

function calcPercentile(value: number, ageMonths: number, data: PercentileRow[], t?: (key: string) => string): PercentileResult {
  const row = interpolateWHO(data, ageMonths);
  if (!row) return { value: 50, label: 'P50', color: Colors.success, bg: '#EBF5F1' };

  const pct = estimatePercentile(value, row);

  if (pct < 3)  return { value: pct, label: t ? t('growth.p_below_3') : 'Sub P3',  color: '#DC2626', bg: '#FEE2E2' };
  if (pct < 15) return { value: pct, label: `P${Math.round(pct)}`, color: '#D4A574', bg: '#FEF3CD' };
  if (pct < 85) return { value: pct, label: `P${Math.round(pct)}`, color: '#5C8A7A', bg: '#EBF5F1' };
  if (pct < 97) return { value: pct, label: `P${Math.round(pct)}`, color: '#D4A574', bg: '#FEF3CD' };
  return { value: pct, label: t ? t('growth.p_above_97') : 'Peste P97', color: '#D4A574', bg: '#FEF3CD' };
}

function getWHOData(metric: MetricTab, gender: string): PercentileRow[] {
  const isFemale = gender === 'female';
  if (metric === 'weight') return isFemale ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS;
  if (metric === 'height') return isFemale ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS;
  return WHO_HEAD;
}

function formatAge(months: number, t?: (key: string) => string): string {
  if (months === 0) return t ? t('growth.newborn') : 'Nou-născut';
  if (months < 12) return `${months} ${months === 1 ? (t ? t('growth.month_one') : 'lună') : (t ? t('growth.months') : 'luni')}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (m === 0) return `${y} ${y === 1 ? (t ? t('growth.year_one') : 'an') : (t ? t('growth.years') : 'ani')}`;
  return `${y}a ${m}l`;
}

function formatDate(ts: Timestamp, locale = 'ro-RO'): string {
  const d = ts.toDate();
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMeasurementValue(m: MeasurementRecord, metric: MetricTab): number | undefined {
  if (metric === 'weight') return m.weight;
  if (metric === 'height') return m.height;
  return m.headCircumference;
}

function getMetricUnit(metric: MetricTab): string {
  return metric === 'weight' ? 'kg' : 'cm';
}

function getMetricLabel(metric: MetricTab, t?: (key: string) => string): string {
  if (metric === 'weight') return t ? t('growth.metric_weight') : 'Greutate';
  if (metric === 'height') return t ? t('growth.metric_height') : 'Înălțime';
  return t ? t('growth.metric_head') : 'Perimetru cranian';
}

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

// ─── WHO Chart Component ───────────────────────────────────────────────────────

const CHART_HEIGHT = 220;
const CHART_PADDING_LEFT = 36;
const CHART_PADDING_RIGHT = 8;
const CHART_PADDING_TOP = 12;
const CHART_PADDING_BOTTOM = 28;
const X_LABELS = [0, 3, 6, 9, 12, 18, 24];

interface ChartProps {
  data: PercentileRow[];
  measurements: MeasurementRecord[];
  metric: MetricTab;
  accentColor: string;
}

function WHOChart({ data, measurements, metric, accentColor }: ChartProps) {
  const screenW = Dimensions.get('window').width - 32; // horizontal margin total
  const chartW = screenW - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;

  // Determine Y range from WHO data
  const allVals = data.flatMap(r => [r.p3, r.p97]);
  const yMin = Math.floor(Math.min(...allVals) * 0.95);
  const yMax = Math.ceil(Math.max(...allVals) * 1.02);
  const xMin = 0;
  const xMax = 24;

  const toX = (age: number) =>
    CHART_PADDING_LEFT + ((age - xMin) / (xMax - xMin)) * chartW;

  const toY = (val: number) =>
    CHART_PADDING_TOP + (1 - (val - yMin) / (yMax - yMin)) * (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM);

  // Build band polygons between adjacent percentile pairs
  // Render as a series of trapezoid-shaped View rectangles per segment
  // We split into segments between adjacent data points and draw bands

  type Band = { topKey: keyof PercentileRow; botKey: keyof PercentileRow; color: string };
  const bands: Band[] = [
    { topKey: 'p3',  botKey: 'p15', color: 'rgba(220,38,38,0.08)' },
    { topKey: 'p15', botKey: 'p85', color: 'rgba(92,138,122,0.10)' },
    { topKey: 'p85', botKey: 'p97', color: 'rgba(212,165,116,0.12)' },
  ];

  // Render each percentile line as thin 1.5px-tall absolutely positioned segments
  type LineSpec = { key: keyof PercentileRow; color: string; width: number };
  const lines: LineSpec[] = [
    { key: 'p3',  color: 'rgba(220,38,38,0.55)',   width: 1 },
    { key: 'p15', color: 'rgba(212,165,116,0.65)',  width: 1 },
    { key: 'p50', color: 'rgba(92,138,122,0.9)',    width: 1.5 },
    { key: 'p85', color: 'rgba(212,165,116,0.65)',  width: 1 },
    { key: 'p97', color: 'rgba(220,38,38,0.55)',    width: 1 },
  ];

  // Child measurement points + connecting line segments
  const childPoints = measurements
    .filter(m => getMeasurementValue(m, metric) !== undefined)
    .map(m => ({
      x: toX(Math.min(m.ageMonths, 24)),
      y: toY(getMeasurementValue(m, metric)!),
      value: getMeasurementValue(m, metric)!,
      age: m.ageMonths,
    }))
    .sort((a, b) => a.age - b.age);

  // Y axis tick values
  const yTicks: number[] = [];
  const yStep = Math.ceil((yMax - yMin) / 4);
  for (let v = Math.ceil(yMin); v <= yMax; v += yStep) yTicks.push(v);

  return (
    <View style={{ width: screenW, height: CHART_HEIGHT, position: 'relative' }}>
      {/* Y-axis labels */}
      {yTicks.map((tick) => {
        const y = toY(tick);
        return (
          <View key={tick} style={{ position: 'absolute', top: y - 7, left: 0, width: CHART_PADDING_LEFT - 4 }}>
            <Text style={styles.chartYLabel}>{tick}</Text>
          </View>
        );
      })}

      {/* Horizontal grid lines */}
      {yTicks.map((tick) => {
        const y = toY(tick);
        return (
          <View
            key={`grid-${tick}`}
            style={{
              position: 'absolute',
              top: y,
              left: CHART_PADDING_LEFT,
              width: chartW,
              height: 1,
              backgroundColor: 'rgba(184,154,126,0.12)',
            }}
          />
        );
      })}

      {/* Percentile bands — rendered as trapezoid approximations per segment */}
      {bands.map((band) =>
        data.slice(0, -1).map((row, i) => {
          const next = data[i + 1];
          const x1 = toX(row.age);
          const x2 = toX(next.age);
          const topY1 = toY(row[band.topKey] as number);
          const topY2 = toY(next[band.topKey] as number);
          const botY1 = toY(row[band.botKey] as number);
          const botY2 = toY(next[band.botKey] as number);
          // Approximate trapezoid as a rectangle using average top/bottom
          const left = x1;
          const right = x2;
          const top = Math.min(topY1, topY2);
          const bottom = Math.max(botY1, botY2);
          return (
            <View
              key={`${band.topKey}-${band.botKey}-${i}`}
              style={{
                position: 'absolute',
                left,
                top,
                width: right - left,
                height: Math.max(1, bottom - top),
                backgroundColor: band.color,
              }}
            />
          );
        })
      )}

      {/* Percentile lines as thin horizontal segments */}
      {lines.map((line) =>
        data.slice(0, -1).map((row, i) => {
          const next = data[i + 1];
          const x1 = toX(row.age);
          const x2 = toX(next.age);
          const y1 = toY(row[line.key] as number);
          const y2 = toY(next[line.key] as number);
          // Draw as a rotated thin rect — approximate with multiple dots if big angle
          // For simplicity: draw at y1 and let it go to y2, use a sloped rect approach
          // We'll use the midpoint for a flat segment and stack them
          const segCount = Math.max(1, Math.round((x2 - x1) / 4));
          const segments: React.ReactElement[] = [];
          for (let s = 0; s < segCount; s++) {
            const t0 = s / segCount;
            const t1 = (s + 1) / segCount;
            const sx = lerp(x1, x2, t0);
            const ex = lerp(x1, x2, t1);
            const sy = lerp(y1, y2, t0);
            const ey = lerp(y1, y2, t1);
            const midY = (sy + ey) / 2;
            segments.push(
              <View
                key={`${line.key}-${i}-s${s}`}
                style={{
                  position: 'absolute',
                  left: sx,
                  top: midY - line.width / 2,
                  width: ex - sx + 0.5,
                  height: line.width,
                  backgroundColor: line.color,
                }}
              />
            );
          }
          return segments;
        })
      )}

      {/* Child measurement connecting line */}
      {childPoints.length > 1 &&
        childPoints.slice(0, -1).map((pt, i) => {
          const next = childPoints[i + 1];
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`child-line-${i}`}
              style={{
                position: 'absolute',
                left: pt.x,
                top: pt.y,
                width: len,
                height: 2.5,
                backgroundColor: accentColor,
                borderRadius: 2,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}

      {/* Child measurement dots */}
      {childPoints.map((pt, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: pt.x - 6,
            top: pt.y - 6,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: accentColor,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 3,
            elevation: 3,
          }}
        />
      ))}

      {/* X axis labels */}
      {X_LABELS.map((label) => (
        <View
          key={`xl-${label}`}
          style={{
            position: 'absolute',
            bottom: 2,
            left: toX(label) - 14,
            width: 28,
            alignItems: 'center',
          }}
        >
          <Text style={styles.chartXLabel}>{label}l</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Percentile Legend ─────────────────────────────────────────────────────────

function PercentileLegend() {
  const items = [
    { color: 'rgba(220,38,38,0.55)',  label: 'P3' },
    { color: 'rgba(212,165,116,0.8)', label: 'P15' },
    { color: 'rgba(92,138,122,1)',    label: 'P50' },
    { color: 'rgba(212,165,116,0.8)', label: 'P85' },
    { color: 'rgba(220,38,38,0.55)',  label: 'P97' },
  ];
  return (
    <View style={styles.legendRow}>
      {items.map(item => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: item.color }]} />
          <Text style={styles.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Percentile Badge ──────────────────────────────────────────────────────────

function PercentileBadge({ result, size = 'md' }: { result: PercentileResult; size?: 'sm' | 'md' }) {
  const isSmall = size === 'sm';
  return (
    <View style={[styles.percentileBadge, { backgroundColor: result.bg }, isSmall && styles.percentileBadgeSm]}>
      <Text style={[styles.percentileBadgeText, { color: result.color }, isSmall && styles.percentileBadgeTextSm]}>
        {result.label}
      </Text>
    </View>
  );
}

// ─── History Item ─────────────────────────────────────────────────────────────

function HistoryItem({
  record,
  metric,
  whoData,
  accentColor,
  onEdit,
  onDelete,
}: {
  record: MeasurementRecord;
  metric: MetricTab;
  whoData: PercentileRow[];
  accentColor: string;
  onEdit: (record: MeasurementRecord) => void;
  onDelete: (record: MeasurementRecord) => void;
}) {
  const { t, i18n } = useTranslation();
  const value = getMeasurementValue(record, metric);
  if (value === undefined) return null;
  const pct = calcPercentile(value, record.ageMonths, whoData, t);
  const unit = getMetricUnit(metric);
  const locale = i18n.language === 'en' ? 'en-US' : 'ro-RO';

  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyDot, { backgroundColor: accentColor }]} />
      <View style={styles.historyContent}>
        <View style={styles.historyTop}>
          <Text style={styles.historyValue}>
            {value.toFixed(metric === 'weight' ? 2 : 1)} {unit}
          </Text>
          <View style={styles.historyActions}>
            <PercentileBadge result={pct} size="sm" />
            <TouchableOpacity
              onPress={() => onEdit(record)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              style={styles.historyActionBtn}
            >
              <Text style={styles.historyActionEdit}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(record)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              style={styles.historyActionBtn}
            >
              <Text style={styles.historyActionDelete}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.historyBottom}>
          <Text style={styles.historyDate}>{formatDate(record.date, locale)}</Text>
          <Text style={styles.historyAge}>{formatAge(record.ageMonths, t)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function GrowthScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeChild, measurements, setMeasurements } = useChildStore();

  const [activeTab, setActiveTab] = useState<MetricTab>('weight');
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputDate, setInputDate] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MeasurementRecord | null>(null);

  const gender = activeChild?.gender ?? 'male';
  const accentColor = Colors.growth;

  // Age calculation
  const ageMonths = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : 0;

  const whoData = getWHOData(activeTab, gender);

  // Load ALL measurements from Firestore on mount (always reload when child changes)
  useEffect(() => {
    if (!user || !activeChild?.id) return;
    setIsLoadingData(true);
    const ref = collection(db, 'users', user.uid, 'children', activeChild.id, 'measurements');
    const q = query(ref, orderBy('date', 'asc'));
    getDocs(q)
      .then(snap => {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as MeasurementRecord));
        setMeasurements(loaded);
      })
      .catch(() => {})
      .finally(() => setIsLoadingData(false));
  }, [user?.uid, activeChild?.id]);

  // Measurements for active tab (has a value for this metric)
  const tabMeasurements = measurements.filter(m => getMeasurementValue(m, activeTab) !== undefined);
  const lastEntry = tabMeasurements.length > 0 ? tabMeasurements[tabMeasurements.length - 1] : null;
  const currentValue = lastEntry ? getMeasurementValue(lastEntry, activeTab) : undefined;
  const currentPct = currentValue !== undefined
    ? calcPercentile(currentValue, lastEntry!.ageMonths, whoData, t)
    : null;
  const growthInsight = (() => {
    if (measurements.length === 0) return t('growth.insight_empty');
    const available = [
      measurements.some((m) => m.weight !== undefined) && t('growth.metric_weight').toLowerCase(),
      measurements.some((m) => m.height !== undefined) && t('growth.metric_height').toLowerCase(),
      measurements.some((m) => m.headCircumference !== undefined) && t('growth.metric_head').toLowerCase(),
    ].filter(Boolean).join(', ');
    if (measurements.length === 1) {
      return t('growth.insight_one', { available });
    }
    if (currentPct) {
      return t('growth.insight_current', { childName: activeChild?.name || t('growth.child_fallback'), count: measurements.length, metric: getMetricLabel(activeTab, t).toLowerCase(), percentile: currentPct.label });
    }
    return t('growth.insight_many', { count: measurements.length, available });
  })();

  const saveMeasurement = useCallback(async () => {
    if (!user || !activeChild?.id) return;
    const raw = inputValue.replace(',', '.');
    const value = parseFloat(raw);
    if (isNaN(value) || value <= 0) {
      Toast.show({ type: 'error', text1: t('growth.invalid_value') });
      return;
    }

    // Validate ranges
    if (activeTab === 'weight' && (value < 0.5 || value > 50)) {
      Toast.show({ type: 'error', text1: t('growth.invalid_weight') });
      return;
    }
    if (activeTab === 'height' && (value < 30 || value > 130)) {
      Toast.show({ type: 'error', text1: t('growth.invalid_height') });
      return;
    }
    if (activeTab === 'head' && (value < 25 || value > 60)) {
      Toast.show({ type: 'error', text1: t('growth.invalid_head') });
      return;
    }

    // Parse date
    const recordDate = inputDate;
    if (Number.isNaN(recordDate.getTime())) {
      Toast.show({ type: 'error', text1: t('growth.invalid_date') });
      return;
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (recordDate.getTime() > todayEnd.getTime()) {
      Toast.show({ type: 'error', text1: t('growth.future_date') });
      return;
    }
    const ts = Timestamp.fromDate(recordDate);

    const birthMs = activeChild.birthDate?.toDate().getTime() ?? Date.now();
    const recAgeMonths = Math.max(0, Math.floor((recordDate.getTime() - birthMs) / (1000 * 60 * 60 * 24 * 30.44)));

    const record: Omit<MeasurementRecord, 'id'> = {
      date: ts,
      ageMonths: recAgeMonths,
      ...(activeTab === 'weight' && { weight: value }),
      ...(activeTab === 'height' && { height: value }),
      ...(activeTab === 'head'   && { headCircumference: value }),
    };

    setIsSaving(true);
    try {
      const current = useChildStore.getState().measurements;

      if (editingRecord?.id) {
        // Update intrare existentă
        const docRef = doc(db, 'users', user.uid, 'children', activeChild.id, 'measurements', editingRecord.id);
        await updateDoc(docRef, { ...record });
        const updated = current
          .map(m => m.id === editingRecord.id ? { ...m, ...record } : m)
          .sort((a, b) => a.date.toMillis() - b.date.toMillis());
        setMeasurements(updated);
        Toast.show({ type: 'success', text1: t('growth.updated') });
      } else {
        // Adaugă intrare nouă
        const ref = collection(db, 'users', user.uid, 'children', activeChild.id, 'measurements');
        const docRef = await addDoc(ref, { ...record, createdAt: serverTimestamp() });
        const newRecord: MeasurementRecord = { ...record, id: docRef.id };
        const updated = [...current, newRecord].sort((a, b) => a.date.toMillis() - b.date.toMillis());
        setMeasurements(updated);
        Toast.show({
          type: 'success',
          text1: t('growth.saved'),
          text2: t('growth.saved_detail', { value, unit: getMetricUnit(activeTab), age: recAgeMonths }),
        });
      }

      setShowModal(false);
      setEditingRecord(null);
      setInputValue('');
      setInputDate(new Date());
    } catch (err) {
      Toast.show({ type: 'error', text1: t('growth.save_error'), text2: t('growth.check_connection') });
    } finally {
      setIsSaving(false);
    }
  }, [user, activeChild, inputValue, inputDate, activeTab, editingRecord, setMeasurements]);

  const startEditMeasurement = (record: MeasurementRecord) => {
    const val = getMeasurementValue(record, activeTab);
    if (val === undefined) return;
    const d = record.date.toDate();
    setEditingRecord(record);
    setInputValue(String(val));
    setInputDate(d);
    setShowModal(true);
  };

  const deleteMeasurement = (record: MeasurementRecord) => {
    if (!user || !activeChild?.id || !record.id) return;
    const doDelete = async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'children', activeChild.id, 'measurements', record.id!));
        const updated = useChildStore.getState().measurements.filter(m => m.id !== record.id);
        setMeasurements(updated);
        Toast.show({ type: 'success', text1: t('growth.deleted') });
      } catch {
        Toast.show({ type: 'error', text1: t('growth.delete_error') });
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('growth.delete_confirm_web'))) doDelete();
    } else {
      Alert.alert(t('growth.delete_title'), t('growth.delete_msg'), [
        { text: t('growth.cancel'), style: 'cancel' },
        { text: t('growth.delete_action'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const tabs: { key: MetricTab; label: string }[] = [
    { key: 'weight', label: t('growth.metric_weight') },
    { key: 'height', label: t('growth.metric_height') },
    { key: 'head',   label: t('growth.metric_head_short') },
  ];

  const genderEmoji = gender === 'female' ? '👧' : '👦';
  const genderLabel = gender === 'female' ? t('growth.girls') : t('growth.boys');
  const locale = i18n.language === 'en' ? 'en-US' : 'ro-RO';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('growth.title')}</Text>
          {activeChild && (
            <Text style={styles.headerSub}>
              {genderEmoji} {activeChild.name} · {formatAge(ageMonths, t)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditingRecord(null); setInputValue(''); setInputDate(new Date()); setShowModal(true); }}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Current measurement hero card */}
        {currentValue !== undefined && currentPct && (
          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroMetric}>{getMetricLabel(activeTab, t)}</Text>
              <Text style={styles.heroValue}>
                {currentValue.toFixed(activeTab === 'weight' ? 2 : 1)}
                <Text style={styles.heroUnit}> {getMetricUnit(activeTab)}</Text>
              </Text>
              {lastEntry && (
                <Text style={styles.heroDate}>{formatDate(lastEntry.date, locale)}</Text>
              )}
            </View>
            <View style={[styles.percentileCircle, { borderColor: currentPct.color }]}>
              <Text style={[styles.percentileCircleNum, { color: currentPct.color }]}>
                {Math.round(currentPct.value)}
              </Text>
              <Text style={[styles.percentileCircleSub, { color: currentPct.color }]}>{t('growth.percentile')}</Text>
            </View>
          </View>
        )}

        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>{t('growth.insight_label')}</Text>
          <Text style={styles.insightText}>{growthInsight}</Text>
        </View>

        {/* Metric tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* WHO Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{t('growth.chart_title')}</Text>
            <View style={styles.chartGenderBadge}>
              <Text style={styles.chartGenderText}>{genderLabel}</Text>
            </View>
          </View>

          {isLoadingData ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator color={accentColor} />
            </View>
          ) : (
            <WHOChart
              data={whoData}
              measurements={tabMeasurements}
              metric={activeTab}
              accentColor={accentColor}
            />
          )}

          <PercentileLegend />

          <View style={styles.bandLegend}>
            <View style={[styles.bandSwatch, { backgroundColor: 'rgba(220,38,38,0.15)' }]} />
            <Text style={styles.bandLabel}>{t('growth.band_outside')}</Text>
            <View style={[styles.bandSwatch, { backgroundColor: 'rgba(92,138,122,0.15)', marginLeft: 10 }]} />
            <Text style={styles.bandLabel}>{t('growth.band_normal')}</Text>
          </View>
        </View>

        {/* Percentile explanation */}
        {currentPct && (
          <View style={[styles.pctExplainCard, { backgroundColor: currentPct.bg, borderColor: currentPct.color + '30' }]}>
            <Text style={[styles.pctExplainTitle, { color: currentPct.color }]}>
              {currentPct.label}
            </Text>
            <Text style={styles.pctExplainText}>
              {currentPct.value < 3
                ? t('growth.explanation_low')
                : currentPct.value < 15
                ? t('growth.explanation_low_normal')
                : currentPct.value < 85
                ? t('growth.explanation_normal')
                : currentPct.value < 97
                ? t('growth.explanation_high_normal')
                : t('growth.explanation_high')}
            </Text>
          </View>
        )}

        {/* Add measurement button (inline) */}
        <TouchableOpacity style={styles.addInlineBtn} onPress={() => { setEditingRecord(null); setInputValue(''); setInputDate(new Date()); setShowModal(true); }} activeOpacity={0.85}>
          <Text style={styles.addInlineBtnText}>{t('growth.add_measurement_cta')}</Text>
        </TouchableOpacity>

        {/* History */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>{t('growth.history_title', { metric: getMetricLabel(activeTab, t).toLowerCase() })}</Text>
          {tabMeasurements.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📏</Text>
              <Text style={styles.emptyText}>{t('growth.empty_title')}</Text>
              <Text style={styles.emptySubtext}>{t('growth.empty_subtitle')}</Text>
            </View>
          ) : (
            [...tabMeasurements].reverse().map(m => (
              <HistoryItem
                key={m.id ?? m.date.toMillis()}
                record={m}
                metric={activeTab}
                whoData={whoData}
                accentColor={accentColor}
                onEdit={startEditMeasurement}
                onDelete={deleteMeasurement}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Measurement Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); setEditingRecord(null); }}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setShowModal(false); setEditingRecord(null); }} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {t('growth.modal_title', { action: editingRecord ? t('growth.action_edit') : t('growth.action_add'), metric: getMetricLabel(activeTab, t).toLowerCase() })}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>
                {t('growth.value_label', { unit: getMetricUnit(activeTab) })}
              </Text>
              <TextInput
                style={styles.modalInput}
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="decimal-pad"
                placeholder={activeTab === 'weight' ? 'ex: 7.5' : 'ex: 68.2'}
                placeholderTextColor={Colors.textTertiary}
                autoFocus
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>{t('growth.date_label')}</Text>
              <AppDatePicker value={inputDate} onChange={setInputDate} mode="date" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
            </View>

            <TouchableOpacity
              style={[styles.modalSaveBtn, isSaving && { opacity: 0.6 }]}
              onPress={saveMeasurement}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.modalSaveBtnText}>{t('growth.save')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowModal(false); setEditingRecord(null); }}>
              <Text style={styles.modalCancelBtnText}>{t('growth.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: 'Geist',
    marginRight: Spacing.md,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.growth,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  addBtnText: {
    fontSize: 22,
    color: Colors.white,
    fontFamily: 'Geist',
    lineHeight: 26,
    marginTop: -1,
  },

  scroll: {
    paddingBottom: Spacing['3xl'],
  },

  // Hero card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    ...Shadow.md,
  },
  heroLeft: {
    flex: 1,
  },
  heroMetric: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  heroValue: {
    fontSize: 36,
    fontFamily: 'Geist-Bold',
    color: Colors.textPrimary,
    lineHeight: 40,
  },
  heroUnit: {
    fontSize: 18,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  heroDate: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  percentileCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  percentileCircleNum: {
    fontSize: 26,
    fontFamily: 'Geist-Bold',
    lineHeight: 30,
  },
  percentileCircleSub: {
    fontSize: 9,
    fontFamily: 'Geist-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: -1,
  },
  insightCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.growth + '30',
    ...Shadow.sm,
  },
  insightLabel: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.growth,
    marginBottom: Spacing.xs,
  },
  insightText: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.xl,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.growth,
  },

  // Chart card
  chartCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingLeft: Spacing.sm,
    ...Shadow.sm,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  chartGenderBadge: {
    backgroundColor: Colors.backgroundSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  chartGenderText: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
  },
  chartLoading: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chart labels
  chartYLabel: {
    fontSize: 9,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  chartXLabel: {
    fontSize: 9,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  legendItem: {
    alignItems: 'center',
    gap: 3,
  },
  legendLine: {
    width: 22,
    height: 2.5,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 9,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  bandLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bandSwatch: {
    width: 14,
    height: 10,
    borderRadius: 3,
    marginRight: 4,
  },
  bandLabel: {
    fontSize: 9,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },

  // Percentile badge
  percentileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  percentileBadgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  percentileBadgeText: {
    fontSize: 12,
    fontFamily: 'Geist-Bold',
  },
  percentileBadgeTextSm: {
    fontSize: 10,
  },

  // Percentile explanation card
  pctExplainCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  pctExplainTitle: {
    fontSize: 15,
    fontFamily: 'Geist-Bold',
    marginBottom: Spacing.xs,
  },
  pctExplainText: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  // Add inline button
  addInlineBtn: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    height: 52,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.growth,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  addInlineBtnText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },

  // History
  historySection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  historyTitle: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    flexShrink: 0,
  },
  historyContent: {
    flex: 1,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyActionBtn: {
    padding: 2,
  },
  historyActionEdit: {
    fontSize: 14,
  },
  historyActionDelete: {
    fontSize: 14,
  },
  historyValue: {
    fontSize: 16,
    fontFamily: 'Geist-Bold',
    color: Colors.textPrimary,
  },
  historyBottom: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 3,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  historyAge: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61,46,42,0.4)',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    ...Shadow.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  modalInputGroup: {
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft,
    paddingHorizontal: Spacing.md,
    fontSize: 17,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  modalSaveBtn: {
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.growth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadow.md,
  },
  modalSaveBtnText: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  modalCancelBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
});
