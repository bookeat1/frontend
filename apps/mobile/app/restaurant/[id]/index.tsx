import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "../../../src/components/IconButton";
import { PhotoPreviewStrip } from "../../../src/components/PhotoPreviewStrip";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { Rating } from "../../../src/components/Rating";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { TableList } from "../../../src/components/TableList";
import { WorkingHoursList } from "../../../src/components/WorkingHoursList";
import { useRestaurant } from "../../../src/hooks/useRestaurant";

const t = getDictionary();

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <IconButton
            glyph="←"
            accessibilityLabel={t.a11y.backButton}
            onPress={() => router.back()}
          />
          <IconButton
            glyph="♡"
            accessibilityLabel={t.a11y.favoriteButton}
            onPress={() => {}}
          />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <LoadingState title={t.common.loading} />
      ) : isError || !restaurant ? (
        <ErrorState
          title={t.search.errorTitle}
          description={t.search.errorDescription}
          retryLabel={t.common.retry}
          onRetry={() => refetch()}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Image
            source={{ uri: restaurant.coverPhoto.uri }}
            style={styles.cover}
            contentFit="cover"
            accessibilityLabel={restaurant.coverPhoto.alt}
            transition={200}
          />

          <View style={styles.body}>
            <Text style={styles.name}>{restaurant.name}</Text>

            <View style={styles.metaRow}>
              <Rating value={restaurant.rating} reviewsCount={restaurant.reviewsCount} />
              <Text
                style={[
                  styles.statusText,
                  !restaurant.isOpenNow && styles.statusTextClosed,
                ]}
              >
                {restaurant.isOpenNow ? t.restaurant.openNow : t.restaurant.closedNow}
              </Text>
            </View>

            <Text style={styles.cuisine}>
              {t.restaurant.cuisineAndPrice(
                restaurant.cuisines.map((c) => c.name).join(", "),
                restaurant.priceLevel,
              )}
            </Text>

            <Section title={t.restaurant.about}>
              <Text style={styles.description}>{restaurant.description}</Text>
            </Section>

            <Section title={t.restaurant.address}>
              <Text style={styles.address}>
                {restaurant.city}, {restaurant.address}
              </Text>
            </Section>

            <PhotoPreviewStrip
              photos={restaurant.photos}
              onPressPhoto={(index) =>
                router.push(`/restaurant/${restaurant.id}/photo/${index}`)
              }
              onSeeAll={() => router.push(`/restaurant/${restaurant.id}/photos`)}
            />

            <Section title={t.restaurant.workingHours}>
              <WorkingHoursList hours={restaurant.workingHours} />
            </Section>

            <Section title={t.restaurant.tables}>
              <TableList tables={restaurant.tables} />
            </Section>
          </View>
        </ScrollView>
      )}

      {restaurant ? (
        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.footer}>
            <PrimaryButton
              label={restaurant.isBookable ? t.restaurant.bookTable : t.restaurant.bookingUnavailable}
              onPress={() => {}}
              disabled={!restaurant.isBookable}
            />
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const COVER_HEIGHT = 260;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  headerSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.huge,
  },
  cover: {
    width: "100%",
    height: COVER_HEIGHT,
    backgroundColor: colors.neutral[100],
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  name: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: {
    ...typography.bodyMedium,
    color: colors.semantic.success,
  },
  statusTextClosed: {
    color: colors.semantic.error,
  },
  cuisine: {
    ...typography.body,
    color: colors.neutral[500],
  },
  description: {
    ...typography.body,
    color: colors.neutral[700],
  },
  address: {
    ...typography.body,
    color: colors.neutral[700],
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  footerSafeArea: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    backgroundColor: colors.neutral[0],
  },
  footer: {
    padding: spacing.lg,
  },
});
