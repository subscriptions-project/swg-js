# Experiments and tests for Authorization same-origin/xorigin requests

The structure of the page is:

```
https://pub.com
<script>
fetch('document', {
  credentials: 'omit',
  headers: {
    authorization: 'Bearer *****'
  }
})
</script>
```

Results:

- X-Origin Authorization header always requires preflight.
- `credentials: omit` works for both same and x-origin.
