import { Image, StyleSheet, View } from "react-native";

const splashArtwork = require("../../assets/images/sanketak-splash.png");

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={splashArtwork}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    height: "100%",
    width: "100%",
  },
});
