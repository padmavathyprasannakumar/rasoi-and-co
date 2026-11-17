"""
Cloudinary media storage for Django 6.

Images and 3D models uploaded in Django admin are sent to Cloudinary,
so nothing is lost when Render redeploys (Render's disk is temporary).

The value saved in the database is the path after the cloud name, e.g.
    image/upload/v1731745000/rasoi/products/mixer_ab12cd.jpg
and .url() turns it back into a full https URL with automatic
format + quality (f_auto,q_auto) for images.
"""
import os

from django.conf import settings
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}


@deconstructible
class CloudinaryMediaStorage(Storage):
    def _cloudinary(self):
        import cloudinary  # noqa: F401  (reads CLOUDINARY_URL from the environment)
        import cloudinary.uploader

        return cloudinary

    def _base_url(self):
        cloudinary = self._cloudinary()
        cloud_name = cloudinary.config().cloud_name
        return f'https://res.cloudinary.com/{cloud_name}/'

    def _save(self, name, content):
        cloudinary = self._cloudinary()
        folder = 'rasoi/' + os.path.dirname(name).replace('\\', '/')
        if hasattr(content, 'seek'):
            content.seek(0)
        result = cloudinary.uploader.upload(
            content,
            folder=folder.rstrip('/'),
            filename_override=os.path.basename(name),
            resource_type='auto',
            use_filename=True,
            unique_filename=True,
            overwrite=False,
        )
        secure_url = result['secure_url']
        return secure_url.split('res.cloudinary.com/', 1)[1].split('/', 1)[1]

    def url(self, name):
        if not name:
            return ''
        if name.startswith('http://') or name.startswith('https://'):
            return name
        ext = os.path.splitext(name)[1].lower()
        if name.startswith('image/upload/') and ext in IMAGE_EXTENSIONS:
            return self._base_url() + 'image/upload/f_auto,q_auto/' + name[len('image/upload/'):]
        return self._base_url() + name

    def exists(self, name):
        return False

    def delete(self, name):
        if not name:
            return
        try:
            cloudinary = self._cloudinary()
            resource_type, _, rest = name.split('/', 2)
            parts = rest.split('/')
            if parts and parts[0].startswith('v') and parts[0][1:].isdigit():
                parts = parts[1:]
            public_id = '/'.join(parts)
            if resource_type != 'raw':
                public_id = os.path.splitext(public_id)[0]
            cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
        except Exception:  # deleting is best-effort
            pass

    def size(self, name):
        return 0

    def path(self, name):
        raise NotImplementedError('Cloudinary files have no local path.')


def media_url(file_field, request=None):
    """Return an absolute URL for an ImageField/FileField (works locally and on Cloudinary)."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    if url.startswith('http'):
        return url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


def is_cloudinary():
    return getattr(settings, 'USE_CLOUDINARY', False)
