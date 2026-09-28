import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components";
import { colors, radius, spacing, touchTarget, typography } from "@/constants";
import { useLanguage } from "@/i18n/use-language";
import { useReportDraft } from "@/report-draft";

const imagePickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  mediaTypes: ["images"],
  quality: 0.75,
};

export function PhotoReportScreen() {
  const { t } = useLanguage();
  const { draft, updateDraft } = useReportDraft();
  const { height } = useWindowDimensions();
  const photoUri = draft.photoUri;
  const previewHeight = Math.min(420, Math.max(280, height * 0.42));

  const savePhoto = (uri: string) => {
    updateDraft({ photoUri: uri });
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          t("photo.cameraPermissionTitle"),
          t("photo.cameraPermissionMessage"),
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync(imagePickerOptions);

      if (!result.canceled && result.assets[0]?.uri) {
        savePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t("photo.errorTitle"), t("photo.errorMessage"));
    }
  };

  const chooseFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          t("photo.galleryPermissionTitle"),
          t("photo.galleryPermissionMessage"),
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(imagePickerOptions);

      if (!result.canceled && result.assets[0]?.uri) {
        savePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t("photo.errorTitle"), t("photo.errorMessage"));
    }
  };

  const changePhoto = () => {
    Alert.alert(t("photo.changePhoto"), undefined, [
      { text: t("photo.takePhoto"), onPress: takePhoto },
      { text: t("photo.chooseGallery"), onPress: chooseFromGallery },
      { style: "cancel", text: t("photo.cancel") },
    ]);
  };

  const removePhoto = () => {
    updateDraft({ photoUri: undefined });
  };

  const continueToSuccess = () => {
    router.push("/report/submit");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t("common.goBack")}
            accessibilityRole="button"
            hitSlop={spacing.md}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons color={colors.text} name="chevron-left" size={34} />
          </Pressable>
          <Text style={styles.title}>{t("photo.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {photoUri ? (
          <View style={styles.previewSection}>
            <View style={[styles.previewFrame, { height: previewHeight }]}>
              <Image
                accessibilityLabel={t("photo.previewLabel")}
                resizeMode="cover"
                source={{ uri: photoUri }}
                style={styles.previewImage}
              />
              <Pressable
                accessibilityLabel={t("photo.removePhoto")}
                accessibilityRole="button"
                onPress={removePhoto}
                style={({ pressed }) => [
                  styles.removeBadge,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialIcons color={colors.white} name="close" size={26} />
              </Pressable>
            </View>

            <View style={styles.previewActions}>
              <AppButton
                onPress={changePhoto}
                style={styles.previewAction}
                title={t("photo.changePhoto")}
                variant="outline"
              />
              <AppButton
                onPress={removePhoto}
                style={styles.previewAction}
                title={t("photo.removePhoto")}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons
                color={colors.primary}
                name="photo-camera"
                size={58}
              />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>{t("photo.addPhoto")}</Text>
              <Text style={styles.emptySubtitle}>
                {t("photo.addPhotoSubtitle")}
              </Text>
            </View>
            <View style={styles.emptyActions}>
              <AppButton
                icon={
                  <MaterialIcons
                    color={colors.white}
                    name="photo-camera"
                    size={24}
                  />
                }
                onPress={takePhoto}
                style={styles.fullButton}
                title={t("photo.takePhoto")}
              />
              <AppButton
                icon={
                  <MaterialIcons
                    color={colors.primary}
                    name="photo-library"
                    size={24}
                  />
                }
                onPress={chooseFromGallery}
                style={styles.fullButton}
                title={t("photo.chooseGallery")}
                variant="outline"
              />
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <MaterialIcons
              color={colors.primary}
              name="photo-camera"
              size={28}
            />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>{t("photo.optionalTitle")}</Text>
            <Text style={styles.infoSubtitle}>{t("photo.optionalSubtitle")}</Text>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <MaterialIcons
            color={colors.primary}
            name="verified-user"
            size={27}
          />
          <Text style={styles.privacyText}>{t("photo.privacyHint")}</Text>
        </View>

        <AppButton
          onPress={continueToSuccess}
          style={styles.continueButton}
          title={photoUri ? t("photo.continue") : t("photo.skipContinue")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget.minHeight,
    width: 48,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  continueButton: {
    borderRadius: radius.lg,
    marginTop: "auto",
    minHeight: 60,
  },
  emptyActions: {
    gap: spacing.md,
    width: "100%",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  emptyCopy: {
    gap: spacing.sm,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 104,
    justifyContent: "center",
    width: 104,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.primaryDark,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center",
  },
  fullButton: {
    borderRadius: radius.lg,
    minHeight: 58,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 48,
  },
  infoCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  infoCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  infoIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  infoSubtitle: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  infoTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.78,
  },
  previewAction: {
    borderRadius: radius.lg,
    flex: 1,
    minHeight: 54,
  },
  previewActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  previewFrame: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    boxShadow: "0 8px 22px rgba(23, 33, 27, 0.08)",
    overflow: "hidden",
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  previewSection: {
    gap: spacing.md,
  },
  privacyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  privacyText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.caption,
    lineHeight: 21,
  },
  removeBadge: {
    alignItems: "center",
    backgroundColor: "rgba(23, 33, 27, 0.86)",
    borderColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    width: 46,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: "900",
    lineHeight: 28,
    textAlign: "center",
  },
});
