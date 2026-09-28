import { MaterialIcons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { AppButton, ScreenContainer } from "@/components";
import { colors, radius, spacing, touchTarget, typography } from "@/constants";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { AppLanguage } from "@/i18n";
import { useLanguage } from "@/i18n/use-language";
import { useReportDraft } from "@/report-draft";
import { queueReportForOfflineProcessing } from "@/services";
import { processVoiceReport } from "@/services/voice-report-service";

const reportLanguages: AppLanguage[] = ["en", "hi", "as"];
type VoiceRecordingState = "idle" | "recording" | "recorded" | "playing";

export function VoiceReportScreen() {
  const { height } = useWindowDimensions();
  const { language, t } = useLanguage();
  const { resetDraft, updateDraft } = useReportDraft();
  const { isOnline } = useNetworkStatus();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [selectedReportLanguage, setSelectedReportLanguage] =
    useState<AppLanguage>(language);
  const [recordingState, setRecordingState] =
    useState<VoiceRecordingState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [processingError, setProcessingError] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const playerRef = useRef<AudioPlayer | null>(null);
  const mountedRef = useRef(true);
  const isRecording = recordingState === "recording";
  const hasRecording = Boolean(audioUri) && recordingState !== "idle";

  const compact = height < 760;
  const veryCompact = height < 680;
  const micSize = veryCompact ? 188 : compact ? 210 : 232;
  const micCircleSize = veryCompact ? 96 : compact ? 110 : 124;
  const micIconSize = veryCompact ? 56 : compact ? 64 : 72;
  const ringOuterSize = micSize;
  const ringMiddleSize = micSize - 28;
  const ringInnerSize = micSize - 58;

  useEffect(() => {
    if (recordingState !== "recording") {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingState]);

  useEffect(() => {
    if (recordingState !== "recording") {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 900,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [recordingState, pulse]);

  useEffect(() => {
    if (recordingState !== "playing") {
      return;
    }

    const interval = setInterval(() => {
      const player = playerRef.current;

      if (!player) {
        setRecordingState("recorded");
        return;
      }

      const currentTime = Math.max(0, player.currentTime ?? 0);
      const duration = Math.max(recordedDuration, player.duration ?? 0);

      setPlaybackSeconds(Math.min(currentTime, duration || recordedDuration));

      if (duration > 0) {
        setRecordedDuration(duration);
      }

      if (!player.playing && currentTime > 0) {
        if (duration === 0 || currentTime >= duration - 0.2) {
          setRecordingState("recorded");
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [recordedDuration, recordingState]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!hasRecording) {
          return false;
        }

        confirmDiscard(() => router.back());
        return true;
      },
    );

    return () => subscription.remove();
  }, [hasRecording, t]);

  useEffect(() => {
    mountedRef.current = true;

    requestRecordingPermissionsAsync().then((status) => {
      if (!status.granted) {
        Alert.alert(t("voiceReport.permissionDenied"));
      }
    });

    setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    return () => {
      mountedRef.current = false;
      cleanupPlayer();
    };
  }, [t]);

  const timerText = useMemo(
    () => formatDuration(elapsedSeconds),
    [elapsedSeconds],
  );
  const playbackText = useMemo(
    () => formatDuration(playbackSeconds),
    [playbackSeconds],
  );
  const durationText = useMemo(
    () => formatDuration(recordedDuration),
    [recordedDuration],
  );
  const playbackProgress =
    recordedDuration > 0 ? Math.min(playbackSeconds / recordedDuration, 1) : 0;

  const startRecording = async () => {
    setProcessingError(false);
    setElapsedSeconds(0);
    setPlaybackSeconds(0);
    setRecordedDuration(0);
    setAudioUri(undefined);
    cleanupPlayer();

    const permission = await requestRecordingPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(t("voiceReport.permissionDenied"));
      return;
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();

    if (mountedRef.current) {
      setRecordingState("recording");
    }
  };

  const stopRecording = async () => {
    const finalDuration = Math.max(elapsedSeconds, 1);
    await audioRecorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    const nextAudioUri = audioRecorder.uri;

    if (!nextAudioUri) {
      setRecordingState("idle");
      return;
    }

    setRecordedDuration(finalDuration);
    setPlaybackSeconds(0);
    setAudioUri(nextAudioUri);
    setRecordingState("recorded");
  };

  const playRecording = async () => {
    if (!audioUri || submitting) {
      return;
    }

    let player = playerRef.current;

    if (!player) {
      player = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });
      playerRef.current = player;
    }

    if (playbackSeconds >= recordedDuration) {
      await player.seekTo(0);
      setPlaybackSeconds(0);
    }

    player.play();
    setRecordingState("playing");
  };

  const pausePlayback = () => {
    playerRef.current?.pause();
    setRecordingState("recorded");
  };

  const recordAgain = () => {
    if (submitting) {
      return;
    }

    cleanupPlayer();
    setAudioUri(undefined);
    setElapsedSeconds(0);
    setPlaybackSeconds(0);
    setRecordedDuration(0);
    setSubmitting(false);
    setProcessingError(false);
    updateDraft({
      audioUri: undefined,
      description: "",
      reportingMethod: "voice",
      analysis: undefined,
    });
    setRecordingState("idle");
  };

  const submitRecording = async () => {
    if (!audioUri || submitting) {
      return;
    }

    cleanupPlayer();
    setRecordingState("recorded");
    setSubmitting(true);
    setProcessingError(false);

    try {
      if (!isOnline) {
        const report = await queueReportForOfflineProcessing({
          audioUri,
          description: "",
          reportLanguage: selectedReportLanguage,
          reportingMethod: "voice",
        });

        resetDraft();
        router.replace({
          pathname: "/report/success",
          params: { reportId: report.id },
        });
        return;
      }

      const voiceReport = await processVoiceReport(
        audioUri,
        selectedReportLanguage,
      );

      updateDraft({
        analysis: voiceReport.analysis,
        audioUri,
        description: voiceReport.transcript,
        detectedLanguage: voiceReport.detectedLanguage,
        reportLanguage: selectedReportLanguage,
        reportingMethod: "voice",
      });

      router.push("/report/review");
    } catch (error) {
      console.error("Voice report processing failed:", error);
      setProcessingError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (!hasRecording) {
      router.back();
      return;
    }

    confirmDiscard(() => router.back());
  };

  const handleTypeInstead = () => {
    if (!hasRecording) {
      router.push("/report/text");
      return;
    }

    Alert.alert(
      t("voiceReport.discardRecording"),
      t("voiceReport.typeInsteadDiscardMessage"),
      [
        {
          style: "cancel",
          text: t("voiceReport.keepRecording"),
        },
        {
          onPress: () => {
            recordAgain();
            router.push("/report/text");
          },
          style: "destructive",
          text: t("voiceReport.discard"),
        },
      ],
    );
  };

  const confirmDiscard = (onDiscard: () => void) => {
    Alert.alert(
      t("voiceReport.discardRecording"),
      t("voiceReport.discardRecordingMessage"),
      [
        {
          style: "cancel",
          text: t("voiceReport.keepRecording"),
        },
        {
          onPress: () => {
            recordAgain();
            onDiscard();
          },
          style: "destructive",
          text: t("voiceReport.discard"),
        },
      ],
    );
  };

  function cleanupPlayer() {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    player.pause();
    player.remove();
    playerRef.current = null;
  }

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.12, 0.34],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        }),
      },
    ],
  };

  return (
    <ScreenContainer
      scroll={false}
      style={[styles.screen, compact ? styles.screenCompact : null]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t("common.goBack")}
          accessibilityRole="button"
          hitSlop={spacing.md}
          onPress={handleBack}
          style={styles.backButton}
        >
          <MaterialIcons color={colors.text} name="chevron-left" size={34} />
        </Pressable>
        <Text style={styles.title}>{t("voiceReport.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.languageRow}>
        {reportLanguages.map((item) => {
          const selected = selectedReportLanguage === item;
          const labelKey =
            item === "en"
              ? "voiceReport.english"
              : item === "hi"
                ? "voiceReport.hindi"
                : "voiceReport.assamese";

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={submitting}
              key={item}
              onPress={() => {
                if (!submitting) {
                  setSelectedReportLanguage(item);
                }
              }}
              style={({ pressed }) => [
                styles.languagePill,
                selected ? styles.languagePillSelected : styles.languagePillIdle,
                submitting ? styles.disabledControl : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[
                  styles.languageLabel,
                  selected
                    ? styles.languageLabelSelected
                    : styles.languageLabelIdle,
                ]}
              >
                {t(labelKey)}
              </Text>
              {selected ? (
                <MaterialIcons color={colors.white} name="check" size={17} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {!isOnline ? (
        <View style={styles.offlineNotice}>
          <MaterialIcons color={colors.warning} name="signal-wifi-off" size={24} />
          <View style={styles.offlineNoticeCopy}>
            <Text style={styles.offlineNoticeTitle}>{t("network.offline")}</Text>
            <Text style={styles.offlineNoticeText}>
              {t("offline.voiceSavedDescription")}
            </Text>
          </View>
        </View>
      ) : null}

      {recordingState === "recorded" || recordingState === "playing" ? (
        <View style={styles.previewSection}>
          <View style={styles.previewHeadingBlock}>
            <Text style={styles.statusText}>
              {submitting
                ? t("voiceReport.processingRecording")
                : t("voiceReport.recordingReady")}
            </Text>
            <Text style={styles.previewSubtitle}>
              {submitting
                ? t("voiceReport.processingRecordingSubtitle")
                : t("voiceReport.listenBeforeSubmitting")}
            </Text>
          </View>

          {processingError ? (
            <View style={styles.processingErrorCard}>
              <MaterialIcons color={colors.danger} name="error-outline" size={34} />
              <View style={styles.processingErrorCopy}>
                <Text style={styles.processingErrorTitle}>
                  {t("voiceReport.processErrorTitle")}
                </Text>
                <Text style={styles.processingErrorText}>
                  {t("voiceReport.processErrorSubtitle")}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.playbackCard}>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={recordingState === "playing" ? pausePlayback : playRecording}
              style={({ pressed }) => [
                styles.playButton,
                submitting ? styles.disabledControl : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <MaterialIcons
                color={colors.white}
                name={recordingState === "playing" ? "pause" : "play-arrow"}
                size={42}
              />
            </Pressable>
            <Text style={styles.playbackTitle}>
              {recordingState === "playing"
                ? t("voiceReport.pause")
                : t("voiceReport.play")}
            </Text>
            <View style={styles.staticWaveform}>
              {[18, 30, 42, 26, 50, 34, 22, 44, 28, 36, 20].map((barHeight, index) => (
                <View
                  key={`${barHeight}-${index}`}
                  style={[styles.staticWaveformBar, { height: barHeight }]}
                />
              ))}
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressTime}>{playbackText}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { flex: playbackProgress }]} />
                <View style={{ flex: 1 - playbackProgress }} />
              </View>
              <Text style={styles.progressTime}>{durationText}</Text>
            </View>
          </View>

          <View style={styles.previewActions}>
            <AppButton
              disabled={submitting}
              onPress={recordAgain}
              style={styles.secondaryAction}
              title={t("voiceReport.recordAgain")}
              variant="outline"
            />
            <AppButton
              disabled={!audioUri}
              loading={submitting}
              onPress={submitRecording}
              style={styles.primaryAction}
              title={
                processingError
                  ? t("voiceReport.tryAgain")
                  : t("voiceReport.submitRecording")
              }
            />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.micSection, compact ? styles.micSectionCompact : null]}>
            <WaveformSide compact={compact} side="left" />
            <Pressable
              accessibilityLabel={
                isRecording
                  ? t("voiceReport.recordingAccessibility")
                  : t("voiceReport.startAccessibility")
              }
              accessibilityRole="button"
              onPress={isRecording ? undefined : startRecording}
              style={[styles.micWrap, { height: micSize, width: micSize }]}
            >
              <Animated.View style={[styles.pulseRing, pulseStyle]} />
              <View
                style={[
                  styles.ringOuter,
                  { height: ringOuterSize, width: ringOuterSize },
                ]}
              >
                <View
                  style={[
                    styles.ringMiddle,
                    { height: ringMiddleSize, width: ringMiddleSize },
                  ]}
                >
                  <View
                    style={[
                      styles.ringInner,
                      { height: ringInnerSize, width: ringInnerSize },
                    ]}
                  >
                    <View
                      style={[
                        styles.micCircle,
                        { height: micCircleSize, width: micCircleSize },
                      ]}
                    >
                      <MaterialIcons color={colors.white} name="mic" size={micIconSize} />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
            <WaveformSide compact={compact} side="right" />
          </View>

          <View style={[styles.statusBlock, compact ? styles.statusBlockCompact : null]}>
            <Text style={styles.statusText}>
              {isRecording ? t("voiceReport.speakNow") : t("voiceReport.tapToSpeak")}
            </Text>
            <Text style={styles.timer}>{timerText}</Text>
          </View>

          <View style={[styles.stopArea, compact ? styles.stopAreaCompact : null]}>
            {isRecording ? (
              <>
                <Pressable
                  accessibilityLabel={t("voiceReport.stopAccessibility")}
                  accessibilityRole="button"
                  onPress={stopRecording}
                  style={({ pressed }) => [
                    styles.stopButton,
                    compact ? styles.stopButtonCompact : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.stopSquare, compact ? styles.stopSquareCompact : null]} />
                </Pressable>
                <Text style={styles.stopText}>{t("voiceReport.tapToStop")}</Text>
              </>
            ) : (
              <View style={[styles.stopPlaceholder, compact ? styles.stopPlaceholderCompact : null]} />
            )}
          </View>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={handleTypeInstead}
        style={({ pressed }) => [
          styles.typeInsteadCard,
          submitting ? styles.disabledControl : null,
          pressed && !submitting ? styles.pressed : null,
        ]}
      >
        <MaterialIcons color={colors.primary} name="graphic-eq" size={compact ? 34 : 38} />
        <Text style={styles.typeInsteadText}>{t("voiceReport.typeInstead")}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

function WaveformSide({
  compact,
  side,
}: {
  compact: boolean;
  side: "left" | "right";
}) {
  const barHeights = compact ? [22, 38, 18] : [28, 48, 20];

  return (
    <View
      style={[
        styles.waveform,
        side === "right" ? styles.waveformRight : null,
      ]}
    >
      {barHeights.map((height, index) => (
        <View key={`${side}-${height}-${index}`} style={[styles.waveBar, { height }]} />
      ))}
    </View>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    width: 48,
  },
  disabledControl: {
    opacity: 0.52,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 48,
  },
  languageLabel: {
    fontSize: typography.body,
    fontWeight: "800",
    textAlign: "center",
  },
  languageLabelIdle: {
    color: colors.text,
  },
  languageLabelSelected: {
    color: colors.white,
  },
  languagePill: {
    alignItems: "center",
    borderRadius: radius.lg,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  languagePillIdle: {
    backgroundColor: colors.surface,
  },
  languagePillSelected: {
    backgroundColor: colors.primary,
    boxShadow: "0 4px 12px rgba(15, 107, 58, 0.18)",
  },
  languageRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  micCircle: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  micSection: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 238,
  },
  micSectionCompact: {
    minHeight: 210,
  },
  micWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  offlineNotice: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  offlineNoticeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  offlineNoticeText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
  offlineNoticeTitle: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.78,
  },
  processingErrorCard: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    width: "100%",
  },
  processingErrorCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  processingErrorText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  processingErrorTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  previewActions: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  previewHeadingBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  previewSection: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
  },
  previewSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: "center",
  },
  primaryAction: {
    borderRadius: radius.lg,
    flex: 1.25,
    minHeight: 58,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  progressTime: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center",
  },
  progressTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: "row",
    height: 8,
    overflow: "hidden",
  },
  playButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 82,
    justifyContent: "center",
    width: 82,
  },
  playbackCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
    width: "100%",
  },
  playbackTitle: {
    color: colors.primaryDark,
    fontSize: typography.subheading,
    fontWeight: "900",
    textAlign: "center",
  },
  pulseRing: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  ringInner: {
    alignItems: "center",
    backgroundColor: "rgba(15, 107, 58, 0.12)",
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  ringMiddle: {
    alignItems: "center",
    backgroundColor: "rgba(15, 107, 58, 0.10)",
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  ringOuter: {
    alignItems: "center",
    backgroundColor: "rgba(15, 107, 58, 0.08)",
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  screen: {
    gap: spacing.md,
    justifyContent: "space-between",
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  screenCompact: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  secondaryAction: {
    borderRadius: radius.lg,
    flex: 1,
    minHeight: 58,
  },
  statusBlock: {
    alignItems: "center",
    gap: spacing.sm,
  },
  statusBlockCompact: {
    gap: spacing.xs,
  },
  statusText: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "600",
    textAlign: "center",
  },
  stopArea: {
    alignItems: "center",
    minHeight: 116,
  },
  stopAreaCompact: {
    minHeight: 92,
  },
  stopButton: {
    alignItems: "center",
    backgroundColor: "rgba(180, 35, 24, 0.12)",
    borderRadius: radius.pill,
    height: 82,
    justifyContent: "center",
    width: 82,
  },
  stopButtonCompact: {
    height: 70,
    width: 70,
  },
  stopPlaceholder: {
    height: 82,
  },
  stopPlaceholderCompact: {
    height: 70,
  },
  stopSquare: {
    backgroundColor: "#FF2B2B",
    borderColor: colors.danger,
    borderRadius: 5,
    borderWidth: 2,
    height: 28,
    width: 28,
  },
  stopSquareCompact: {
    height: 24,
    width: 24,
  },
  stopText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  staticWaveform: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    height: 54,
    justifyContent: "center",
  },
  staticWaveformBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    opacity: 0.55,
    width: 5,
  },
  timer: {
    color: colors.text,
    fontSize: 28,
    fontVariant: ["tabular-nums"],
    lineHeight: 38,
    textAlign: "center",
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center",
  },
  typeInsteadCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  typeInsteadText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
  },
  waveBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    opacity: 0.72,
    width: 4,
  },
  waveform: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-start",
  },
  waveformRight: {
    justifyContent: "flex-end",
  },
});
