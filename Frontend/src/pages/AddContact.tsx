// pages/AddContact.tsx  (Owner: Member 2)
import React, { useState } from 'react';
import { showAlert } from '../utils/alert';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { contactsApi } from '../api/contactsApi';
import { getErrorMessage } from '../api/client';
import ContactForm from '../components/ContactForm';
import type { ContactFormValues } from '../components/ContactForm';

export default function AddContact(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (values: ContactFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      const { id } = await contactsApi.create(values);
      navigation.goBack();
      navigation.navigate('ContactDetails', { id });
    } catch (e) {
      showAlert('Could not save', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ContactForm
      mode="create"
      onSubmit={handleSubmit}
      onCancel={() => navigation.goBack()}
      submitting={submitting}
    />
  );
}
