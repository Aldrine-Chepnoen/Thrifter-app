import { View, Text } from 'react-native';

export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-gray-800">Search</Text>
      <Text className="text-sm text-gray-400 mt-1">Search items here</Text>
    </View>
  );
}
