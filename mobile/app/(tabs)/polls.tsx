import { View, Text } from 'react-native';

export default function PollsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-gray-800">Demand Board</Text>
      <Text className="text-sm text-gray-400 mt-1">Community requests will appear here</Text>
    </View>
  );
}
