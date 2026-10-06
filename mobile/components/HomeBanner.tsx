// Mobile port of frontend/src/components/HomeBanner.jsx — same three slides,
// same copy, same cream/gold card treatment and 5s auto-rotate. Framer
// Motion's opacity crossfade becomes RN's Animated API; web's hover-to-pause
// has no touch equivalent, so this just keeps rotating (web already falls
// back to that for touch devices via prefers-reduced-motion, not hover).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, useWindowDimensions } from 'react-native';

const ROTATE_INTERVAL_MS = 5000;
const FADE_MS = 300;
// Fixed row height mirrors web's fixed 134px mobile banner row — keeps the
// carousel from jumping height between slides with differing content.
const BANNER_HEIGHT = 148;

type Props = {
  onExplore?: () => void;
};

function ExploreButton({ onPress }: { onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-row items-center gap-1 self-start rounded-full bg-[#252B32] dark:bg-[#EAAD11] px-3 py-1.5 mt-1.5"
    >
      <Text className="text-white dark:text-black font-sans-bold text-xs">Explore now</Text>
      <Text className="text-white dark:text-black text-xs">{'→'}</Text>
    </TouchableOpacity>
  );
}

function CurrentSlide({ onExplore }: { onExplore?: () => void }) {
  return (
    <View className="flex-row h-full">
      <View className="flex-1 justify-center px-4 py-2">
        <Text className="font-serif-bold text-[16px] leading-[19px] text-[#252B32] dark:text-gray-100">
          Secure your next fit
        </Text>
        <View className="mt-1">
          <Text className="font-sans-bold text-[9px] leading-[13px] text-[#252B32] dark:text-gray-200">
            Discover fashion around Kampala
          </Text>
          <Text className="font-sans-bold text-[8px] leading-[12px] text-[#252B32] dark:text-gray-200">
            Thrift stores, clothing brands, fashion designers
          </Text>
        </View>
        <ExploreButton onPress={onExplore} />
      </View>
      <View className="w-[45%] bg-[#F8F5ED] dark:bg-gray-900">
        <Image
          source={require('../assets/images/new-banner.png')}
          className="w-full h-full"
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

function SellSlide(_props: { onExplore?: () => void }) {
  return (
    <View className="flex-1 justify-center px-4 py-2">
      <Text className="font-serif-bold text-[19px] leading-[22px] text-[#252B32] dark:text-gray-100">
        Sell an item now
      </Text>
      <Text className="font-sans-bold text-[13px] leading-[17px] text-[#252B32] dark:text-gray-200 mt-1.5">
        Sign up as a brand {'→'} Upload items {'→'} We deliver
      </Text>
      <Text className="text-[10px] italic leading-[14px] text-[#252B32]/55 dark:text-gray-500 mt-2">
        Tip: share your vendor link on socials to get more page visits.
      </Text>
    </View>
  );
}

function BuySlide(_props: { onExplore?: () => void }) {
  return (
    <View className="flex-1 h-full">
      <View className="justify-center px-4 py-2 max-w-[62%] h-full">
        <Text className="font-serif-bold text-[17px] leading-[20px] text-[#252B32] dark:text-gray-100">
          Get your items now
        </Text>
        <Text className="font-sans-bold text-[11.5px] leading-[15px] text-[#252B32] dark:text-gray-200 mt-1.5">
          Add to cart {'→'} Checkout {'→'} We deliver
        </Text>
        <Text className="text-[9px] italic leading-[13px] text-[#252B32]/55 dark:text-gray-500 mt-1.5 max-w-[200px]">
          Tip: order from multiple vendors and receive all pieces in one delivery.
        </Text>
      </View>
      <View className="absolute bottom-0 right-0 w-[42%] h-full items-end justify-end" pointerEvents="none">
        <Image
          source={require('../assets/images/delivery-box.png')}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const SLIDES = [CurrentSlide, SellSlide, BuySlide];

export default function HomeBanner({ onExplore }: Props) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % SLIDES.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [opacity]);

  const Slide = SLIDES[index];

  return (
    <View className="px-3 mt-2 mb-4">
      <Animated.View
        style={{ opacity, height: BANNER_HEIGHT }}
        className="rounded-2xl overflow-hidden border-2 border-[#D99A1E] dark:border-[#EAAD11] bg-[#F8F5ED] dark:bg-gray-900"
      >
        <Slide onExplore={index === 0 ? onExplore : undefined} />
      </Animated.View>
    </View>
  );
}
