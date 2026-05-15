import { getHelpMenuBarPosition } from '@/util';

export default ({ menuBarPosition }) => `
    <ul class="tui-image-editor-help-menu ${getHelpMenuBarPosition(menuBarPosition)}"></ul>
    <div class="tui-image-editor-controls">
        <ul class="tui-image-editor-menu"></ul>
    </div>
`;
