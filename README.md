- Setup instructions
  Go to apps/angular-mage-editor directory and run the following commands:

```bash
pnpm install
ng serve
```

- API configuration steps
  AI helped me to configure the API.
- Features implemented

1. Image upload and preview
2. Image editing tools
3. Image filters
4. AI generated images

- Design decisions made

1. User interface design
2. User experience design

- Any challenges faced

google image api does not work as expected. (they have banned the free tier in mainland China), and huggingface api reported a 404 when invoking, worked hard to find a usable API. 

This is the desktop version

![](desktop-image-editor.png)

And this is the mobile version (the submenus are modal)

![](mobile-image-editor.png)


Things left TODO:
1. when opened in very small screen a relatively large picture, the right controls cannot be clicked.