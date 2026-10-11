import { useId, useRef, useState, type FormEvent } from 'react';
import type {
  FieldErrors,
  LocalizedValues,
  PhotoUploadResult,
  PhotoValues,
  ProductFormValues,
  ProductTextField,
  VariantValues,
} from '../../adminForms';
import { blankVariant } from '../../adminForms';
import type { Locale } from '../../i18n/locales';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { Checkbox } from '../atoms/Checkbox';
import { FieldMessage } from '../atoms/FieldMessage';
import { FileInput } from '../atoms/FileInput';
import { SelectInput } from '../atoms/SelectInput';
import { TextInput } from '../atoms/TextInput';
import { FormField } from '../molecules/FormField';
import { LocalizedTextField } from '../molecules/LocalizedTextField';
import { PhotoFields } from '../molecules/PhotoFields';
import { VariantFields } from '../molecules/VariantFields';
import styles from './ProductForm.module.css';

/** The kinds of image the photo picker offers: those the API takes (JPEG, PNG, WebP). */
const PHOTO_PICKER_TYPES = 'image/jpeg,image/png,image/webp';

/** A photo the owner picked: being uploaded, or not uploaded, and why. */
type PickedPhoto = { id: number; name: string; problem?: Exclude<PhotoUploadResult, { photo: PhotoValues }>['problem'] };

/**
 * The product form, for a new product (`mode` 'new': the owner enters the
 * slug) or a stored one ('edit': the slug is shown, and cannot change). It
 * holds what the owner types, and hands it to `onSubmit`; `errors` are the
 * API's field errors, shown next to each field in the owner's locale. Photos
 * the owner picks are uploaded with `uploadPhoto` one after another, each
 * added after the others once uploaded; the form cannot be sent meanwhile.
 */
export function ProductForm({
  mode,
  initial,
  categories,
  errors,
  submitting,
  onSubmit,
  uploadPhoto,
}: {
  mode: 'new' | 'edit';
  initial: ProductFormValues;
  categories: { slug: string; name: string }[];
  errors: FieldErrors;
  submitting: boolean;
  onSubmit: (values: ProductFormValues) => void;
  uploadPhoto: (file: File) => Promise<PhotoUploadResult>;
}) {
  const messages = useMessages().admin;
  const text = messages.productForm;
  const [values, setValues] = useState(initial);
  const featuredHintId = useId();
  // Field errors name variants and photos by position, so they no longer fit
  // once rows are removed or (photos) reordered.
  const [variantsChanged, setVariantsChanged] = useState(false);
  const [photosMoved, setPhotosMoved] = useState(false);
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const lastPickedId = useRef(0);
  const uploading = picked.some((photo) => !photo.problem);

  const errorOf = (path: string) => {
    if (variantsChanged && path.startsWith('variants.')) return undefined;
    if (photosMoved && path.startsWith('photos.')) return undefined;
    const code = errors[path];
    return code && messages.fieldErrors[code];
  };
  const localizedErrors = (path: string): Partial<Record<Locale, string>> => ({
    ja: errorOf(`${path}.ja`) ?? errorOf(path),
    zh: errorOf(`${path}.zh`),
    en: errorOf(`${path}.en`),
  });

  const textField = (field: ProductTextField, options: { required?: boolean; multiline?: boolean } = {}) => (
    <LocalizedTextField
      label={text[field]}
      value={values[field]}
      onChange={(value: LocalizedValues) => setValues({ ...values, [field]: value })}
      errors={localizedErrors(field)}
      {...options}
    />
  );

  const setVariants = (variants: VariantValues[]) => setValues({ ...values, variants });
  const setPhotos = (photos: PhotoValues[]) => setValues({ ...values, photos });

  function movePhoto(index: number, by: -1 | 1) {
    const photos = [...values.photos];
    const [photo] = photos.splice(index, 1);
    if (!photo) return;
    photos.splice(index + by, 0, photo);
    setPhotosMoved(true);
    setPhotos(photos);
  }

  /** Uploads the picked files one after another, so their photos are added in the order picked. */
  async function upload(files: File[]) {
    const queued = files.map((file) => ({ file, id: (lastPickedId.current += 1) }));
    // Problems with earlier picks give way to the new ones.
    setPicked((current) => [
      ...current.filter((photo) => !photo.problem),
      ...queued.map(({ file, id }) => ({ id, name: file.name })),
    ]);
    for (const { file, id } of queued) {
      const result = await uploadPhoto(file);
      if ('photo' in result) {
        setValues((current) => ({ ...current, photos: [...current.photos, result.photo] }));
        setPicked((current) => current.filter((photo) => photo.id !== id));
      } else {
        setPicked((current) => current.map((photo) => (photo.id === id ? { ...photo, problem: result.problem } : photo)));
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setVariantsChanged(false);
    setPhotosMoved(false);
    onSubmit(values);
  }

  return (
    <form noValidate onSubmit={submit} className={styles.form}>
      <section className={styles.section}>
        {mode === 'new' ? (
          <FormField label={text.slug} hint={text.slugHint} error={errorOf('slug')}>
            {(control) => (
              <TextInput
                {...control}
                autoCapitalize="off"
                spellCheck={false}
                value={values.slug}
                onChange={(event) => setValues({ ...values, slug: event.target.value })}
              />
            )}
          </FormField>
        ) : (
          <p className={styles.slug}>
            <span className={styles.slugLabel}>{text.slug}</span> <code>{values.slug}</code>
          </p>
        )}
        <p className={styles.hint}>{text.translationHint}</p>
        {textField('name', { required: true })}
        {textField('description', { required: true, multiline: true })}
      </section>

      <fieldset className={styles.group}>
        <legend className={styles.groupLegend}>{text.photos}</legend>
        <p className={styles.hint}>{text.photosHint}</p>
        {errorOf('photos') && (
          <FieldMessage id="photos-error" tone="error">
            {errorOf('photos')}
          </FieldMessage>
        )}
        {values.photos.map((photo, index) => (
          <PhotoFields
            key={photo.key}
            number={index + 1}
            count={values.photos.length}
            value={photo}
            onChange={(changed) => setPhotos(values.photos.map((p, i) => (i === index ? changed : p)))}
            onMove={(by) => movePhoto(index, by)}
            onRemove={() => {
              setPhotosMoved(true);
              setPhotos(values.photos.filter((_, i) => i !== index));
            }}
            errorOf={(path) => errorOf(`photos.${index}.${path}`)}
          />
        ))}
        <FileInput accept={PHOTO_PICKER_TYPES} multiple disabled={uploading} onPick={(files) => void upload(files)}>
          {text.addPhotos}
        </FileInput>
        <ul aria-live="polite" className={styles.uploads}>
          {picked.map((photo) => (
            <li key={photo.id} className={photo.problem ? styles.uploadProblem : styles.uploading}>
              {photo.problem
                ? text.photoNotUploaded(
                    photo.name,
                    photo.problem === 'failed' ? text.photoUploadFailed : messages.fieldErrors[photo.problem],
                  )
                : text.photoUploading(photo.name)}
            </li>
          ))}
        </ul>
      </fieldset>

      <section className={styles.section}>
        <p className={styles.hint}>{text.detailsHint}</p>
        {textField('materials')}
        {textField('dimensions')}
        {textField('weight')}
        {textField('care', { multiline: true })}
      </section>

      <section className={styles.section}>
        <FormField label={text.category} error={errorOf('categorySlug')}>
          {(control) => (
            <SelectInput
              {...control}
              value={values.categorySlug}
              onChange={(event) => setValues({ ...values, categorySlug: event.target.value })}
            >
              <option value="">{text.noCategory}</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </SelectInput>
          )}
        </FormField>
        <div className={styles.featured}>
          <Checkbox
            checked={values.featured}
            onChange={(featured) => setValues({ ...values, featured })}
            describedBy={featuredHintId}
          >
            {text.featured}
          </Checkbox>
          <FieldMessage id={featuredHintId} tone="hint">
            {text.featuredHint}
          </FieldMessage>
        </div>
      </section>

      <fieldset className={styles.group}>
        <legend className={styles.groupLegend}>{text.variants}</legend>
        {errorOf('variants') && (
          <FieldMessage id="variants-error" tone="error">
            {errorOf('variants')}
          </FieldMessage>
        )}
        {values.variants.map((variant, index) => (
          <VariantFields
            key={variant.key}
            number={index + 1}
            value={variant}
            onChange={(changed) => setVariants(values.variants.map((v, i) => (i === index ? changed : v)))}
            onRemove={() => {
              setVariantsChanged(true);
              setVariants(values.variants.filter((_, i) => i !== index));
            }}
            errorOf={(path) => errorOf(`variants.${index}.${path}`)}
          />
        ))}
        <Button
          variant="secondary"
          className={styles.addVariant}
          onClick={() => {
            setVariantsChanged(true);
            setVariants([...values.variants, blankVariant()]);
          }}
        >
          {text.addVariant}
        </Button>
      </fieldset>

      <Button type="submit" variant="primary" disabled={submitting || uploading} className={styles.submit}>
        {mode === 'new' ? text.create : text.save}
      </Button>
    </form>
  );
}
