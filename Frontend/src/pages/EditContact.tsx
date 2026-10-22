// pages/EditContact.tsx  (Owner: Member 2)
import React, { useCallback, useEffect, useState } from 'react';
import { showAlert } from '../utils/alert';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

import { contactsApi } from '../api/contactsApi';
import { getErrorMessage } from '../api/client';
import ContactForm from '../components/ContactForm';
import type { ContactFormValues } from '../components/ContactForm';
import ConfirmDialog from '../components/ConfirmDialog';
// Member 1's components. Check props if they differ.
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

type EditRoute = RouteProp<{ EditContact: { id: string } }, 'EditContact'>;

export default function EditContact(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<EditRoute>();

  const [initial, setInitial] = useState<ContactFormValues | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInitial(await contactsApi.getFormValues(params.id));
    } catch {
      setError('Could not load this contact.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (values: ContactFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      await contactsApi.update(params.id, values);
      navigation.goBack();
    } catch (e) {
      showAlert('Could not save', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleteOpen(false);
    try {
      await contactsApi.remove(params.id);
      navigation.navigate('Tabs', { screen: 'Contacts', params: { screen: 'ContactsList' } });
    } catch (e) {
      showAlert('Could not delete', getErrorMessage(e));
    }
  };

  if (loading) return <LoadingState />;
  if (error || !initial) return <ErrorState message={error ?? 'Not found'} onRetry={load} />;

  return (
    <>
      <ContactForm
        mode="edit"
        initialValues={initial}
        onSubmit={handleSubmit}
        onCancel={() => navigation.goBack()}
        submitting={submitting}
        onDelete={() => setDeleteOpen(true)}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title="Delete this contact?"
        message="Their memories and history will be removed too. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
