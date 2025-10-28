import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_BASE_URL = 'http://localhost:4000';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  sku: string;
}

export default function StockCount() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const fetchItems = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/inventory/items`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }

      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async () => {
    if (!selectedItemId) {
      Alert.alert('Error', 'Please select an item');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
      Alert.alert('Error', 'Please enter a valid quantity (positive to add, negative to remove)');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please enter a reason for this adjustment');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/inventory/adjustments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: selectedItemId,
          deltaQty: qty,
          reason: reason.trim(),
        }),
      });

      if (response.status === 401) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to record adjustment');
        setSubmitting(false);
        return;
      }

      Alert.alert(
        'Success',
        `Adjustment recorded: ${qty > 0 ? '+' : ''}${qty} units`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedItemId('');
              setQuantity('');
              setReason('');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to record adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033FF" />
        <Text style={styles.loadingText}>Loading items...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Stock Count Adjustment</Text>
        <Text style={styles.subtitle}>
          Enter positive quantity to add stock, negative to remove
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Select Item</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedItemId}
              onValueChange={setSelectedItemId}
              enabled={!submitting}
            >
              <Picker.Item label="-- Select an item --" value="" />
              {items.map(item => (
                <Picker.Item
                  key={item.id}
                  label={`${item.name} (${item.sku})`}
                  value={item.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Quantity Adjustment</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., +10 or -5"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
            editable={!submitting}
          />
          <Text style={styles.hint}>
            Positive adds stock, negative removes
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Physical count, received delivery, damaged goods"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            editable={!submitting}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Submitting...' : 'Record Adjustment'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAEDF3',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAEDF3',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00033D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00033D',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#0033FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#AAA',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
