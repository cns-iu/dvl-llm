import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  Renderer2,
  NgZone,
  HostListener,
  OnInit,
  booleanAttribute,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';

import { FormsModule } from '@angular/forms';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { VisualizeService } from './visualize.service';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AppService,
  UserStory,
  RefinePrompt,
  RefineResponse,
  HistoryItem,
} from '../app.service';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-r';
import 'ace-builds/src-noconflict/theme-monokai';

@Component({
  selector: 'app-visualize',
  standalone: true,
  imports: [CommonModule, FormsModule, AceEditorModule, HttpClientModule],
  templateUrl: './visualize.component.html',
  styleUrl: './visualize.component.css',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('300ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
})
export class VisualizeComponent implements AfterViewInit, OnInit {
  models = ['DeepSeek-R1', 'llama-4-scout'];
  selectedModel = this.models[0];
  storyId!: number;
  languages = ['Python', 'R', 'JavaScript'];
  selectedLanguage = 'Python';
  originalCodeText: string = '';
  isCodeModified: boolean = false;

  isGenerating: boolean = false;
  history: HistoryItem[] = [];

  isDVL: boolean = false;
  /** holds the user story */
  storyDescription = '';
  storyTitle = '';
  selectedLibrary = '';
  codeText: string = '';
  visualSrc: SafeResourceUrl = '';
  isDragging = false;
  isMouseDown = false;

  showDragOverlay = false;
  //refine-prompt suggestions//
  refineText: string = '';
  suggestions: RefinePrompt[] = [];
  isUndoing: boolean = false;

  /*Called when clicked on one of the suggestion buttons */
  setRefinePrompt(description: string): void {
    this.refineText = description;
  }
  //refine-prompt suggestions//

  isVisualizationVisible = true;
  isCodeVisible = true;

  shouldDisplayVisualization = false;

  private originalLeftPaneSize = '40%';
  private originalRightPaneSize = '60%';
  private originalTopPaneSize = '40%';
  private originalBottomPaneSize = '60%';

  private isColumnLayout = false;

  private wasCodeVisible = true;

  @ViewChild('leftPane') leftPane!: ElementRef;
  @ViewChild('rightPane') rightPane!: ElementRef;
  @ViewChild('splitPane') splitPane!: ElementRef;
  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;
  @ViewChild('dragOverlay') dragOverlay!: ElementRef;
  @ViewChild('visualFrame') visualFrame!: ElementRef;
  @ViewChild('visualizationContainer') visualizationContainer!: ElementRef;
  @ViewChild('visualImage') visualImage!: ElementRef<HTMLImageElement>;

  private mouseMoveListener: (() => void) | null = null;
  private mouseUpListener: (() => void) | null = null;
  private touchMoveListener: (() => void) | null = null;
  private touchEndListener: (() => void) | null = null;

  private initialX = 0;
  private initialY = 0;
  private initialLeftWidth = 0;
  private initialTopHeight = 0;
  private totalWidth = 0;
  private totalHeight = 0;
  private dragBar: HTMLElement | null = null;
  generatedFilename: string | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private renderer: Renderer2,
    private el: ElementRef,
    private ngZone: NgZone,
    private visualizeService: VisualizeService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private appService: AppService
  ) {
    this.codeText = '';
  }

  ngOnInit() {
    // console.log(
    //   'Inside ngOnInit  router.getCurrentNavigation():',
    //   this.router.getCurrentNavigation()
    // );

    // 2) Grab all passed via router.navigate(..., { state })
    const state = history.state as {
      id: number;
      model: string;
      language: string;
      library: string;
      isDVL: boolean;
    };
    // console.log('history.state in VisualizeComponent:', state);

    // 3) check if vaild
    if (state && state.id != null) {
      this.storyId = state.id;
      this.selectedModel = state.model || 'DeepSeek-R1';
      this.selectedLanguage = state.language || 'python';
      this.selectedLibrary = state.library || 'plotly';
      this.isDVL = state.isDVL ?? true;
      this.appService.getUserStoryById(this.storyId).subscribe((story) => {
        this.storyDescription = story.description;
        this.storyTitle = story.userstory;
      });
      //to get refine prompts
      this.appService.getRefinePrompts(this.storyId).subscribe((prompts) => {
        this.suggestions = prompts;
      });
      // 5) generate
      // console.log('generateVisualization() calling');
      this.generateVisualization();
    } else {
      console.warn('No valid state—skipping auto-generate.');
    }
  }

  ngAfterViewInit() {
    this.ensureProperSizing();
    this.enhanceDropdowns();
    this.checkLayoutMode();
    window.addEventListener('resize', () => {
      this.ensureProperSizing();
      this.checkLayoutMode();
      this.updateLayoutBasedOnVisibility();
    });
    const dragBar = this.el.nativeElement.querySelector('.drag-bar-vertical');
    if (dragBar) {
      this.renderer.listen(dragBar, 'touchstart', (e: TouchEvent) => {
        this.startTouchDragging(e);
      });
    }
    this.setInitialPaneSizes();
  }

  ngOnDestroy() {
    this.removeAllEventListeners();

    window.removeEventListener('resize', () => {
      this.ensureProperSizing();
      this.checkLayoutMode();
    });
  }

  private checkLayoutMode() {
    const wasColumnLayout = this.isColumnLayout;
    this.isColumnLayout = window.matchMedia('(max-width: 768px)').matches;

    if (wasColumnLayout !== this.isColumnLayout) {
      const dragBar = this.el.nativeElement.querySelector('.drag-bar-vertical');
      if (dragBar) {
        if (this.isColumnLayout) {
          this.renderer.setStyle(dragBar, 'cursor', 'row-resize');
          this.renderer.setStyle(dragBar, 'width', '100%');
          this.renderer.setStyle(dragBar, 'height', '6px');

          const indicator = dragBar.querySelector('::after');
          if (indicator) {
            this.renderer.setStyle(indicator, 'width', '40px');
            this.renderer.setStyle(indicator, 'height', '2px');
          }
        } else {
          this.renderer.setStyle(dragBar, 'cursor', 'col-resize');
          this.renderer.setStyle(dragBar, 'width', '6px');
          this.renderer.setStyle(dragBar, 'height', '100%');

          const indicator = dragBar.querySelector('::after');
          if (indicator) {
            this.renderer.setStyle(indicator, 'width', '2px');
            this.renderer.setStyle(indicator, 'height', '40px');
          }
        }
      }

      const splitPane = this.el.nativeElement.querySelector('.split-pane');
      if (splitPane) {
        if (this.isColumnLayout) {
          this.renderer.setStyle(splitPane, 'flex-direction', 'column');
        } else {
          this.renderer.setStyle(splitPane, 'flex-direction', 'row');
        }
      }

      this.updateLayoutBasedOnVisibility();
    }
  }

  toggleVisualization() {
    this.isVisualizationVisible = !this.isVisualizationVisible;

    if (!this.isVisualizationVisible && !this.isCodeVisible) {
      this.isCodeVisible = true;
    }

    setTimeout(() => {
      this.updateLayoutBasedOnVisibility();
    }, 10);
  }
  toggleCode() {
    this.isCodeVisible = !this.isCodeVisible;

    // Make sure at least ONE pane is always visible
    if (!this.isCodeVisible && !this.isVisualizationVisible) {
      this.isVisualizationVisible = true;
    }

    // Let the existing layout helper apply the correct classes / sizes
    setTimeout(() => this.updateLayoutBasedOnVisibility(), 0);
  }
  private updateLayoutBasedOnVisibility() {
    const leftPane = this.el.nativeElement.querySelector('.left-pane');
    const rightPane = this.el.nativeElement.querySelector('.right-pane');
    const splitPane = this.el.nativeElement.querySelector('.split-pane');

    if (!leftPane || !rightPane || !splitPane) return;

    if (this.isVisualizationVisible && this.isCodeVisible) {
      this.renderer.addClass(splitPane, 'both-visible');
      this.renderer.removeClass(splitPane, 'single-pane');

      if (this.isColumnLayout) {
        this.renderer.setStyle(
          document.documentElement,
          '--top-pane-height',
          this.originalTopPaneSize
        );
        this.renderer.setStyle(
          document.documentElement,
          '--bottom-pane-height',
          this.originalBottomPaneSize
        );

        this.renderer.setStyle(
          leftPane,
          'flex',
          `0 0 ${this.originalTopPaneSize}`
        );
        this.renderer.setStyle(
          rightPane,
          'flex',
          `0 0 ${this.originalBottomPaneSize}`
        );
      } else {
        this.renderer.setStyle(
          document.documentElement,
          '--left-pane-width',
          this.originalLeftPaneSize
        );
        this.renderer.setStyle(
          document.documentElement,
          '--right-pane-width',
          this.originalRightPaneSize
        );

        this.renderer.setStyle(
          leftPane,
          'flex',
          `0 0 ${this.originalLeftPaneSize}`
        );
        this.renderer.setStyle(
          rightPane,
          'flex',
          `0 0 ${this.originalRightPaneSize}`
        );
      }

      this.renderer.removeClass(leftPane, 'hidden');
      this.renderer.removeClass(rightPane, 'hidden');
      this.renderer.removeClass(leftPane, 'fullscreen');
      this.renderer.removeClass(rightPane, 'fullscreen');
    } else if (this.isVisualizationVisible && !this.isCodeVisible) {
      this.renderer.removeClass(splitPane, 'both-visible');
      this.renderer.addClass(splitPane, 'single-pane');
      this.renderer.addClass(leftPane, 'hidden');
      this.renderer.removeClass(rightPane, 'hidden');
      this.renderer.removeClass(leftPane, 'fullscreen');
      this.renderer.addClass(rightPane, 'fullscreen');
      this.renderer.setStyle(rightPane, 'flex', '1 1 auto');
      this.renderer.setStyle(rightPane, 'width', '100%');
      this.renderer.setStyle(rightPane, 'height', '100%');
      this.renderer.setStyle(rightPane, 'max-width', '100%');
      this.renderer.setStyle(rightPane, 'max-height', '100%');
      const iframe = leftPane.querySelector('iframe');
      if (iframe) {
        this.renderer.setStyle(iframe, 'width', '100%');
        this.renderer.setStyle(iframe, 'height', '100%');
      }
    }
  }

  private setInitialPaneSizes() {
    const splitPane = this.el.nativeElement.querySelector('.split-pane');
    const leftPane = this.el.nativeElement.querySelector('.left-pane');
    const rightPane = this.el.nativeElement.querySelector('.right-pane');
    if (splitPane && leftPane && rightPane) {
      const storedLeftPaneSize = localStorage.getItem('leftPaneSize');
      const storedRightPaneSize = localStorage.getItem('rightPaneSize');
      if (storedLeftPaneSize && storedRightPaneSize) {
        this.renderer.setStyle(
          document.documentElement,
          '--left-pane-width',
          storedLeftPaneSize
        );
        this.renderer.setStyle(
          document.documentElement,
          '--right-pane-width',
          storedRightPaneSize
        );
        this.renderer.setStyle(leftPane, 'flex', `0 0 ${storedLeftPaneSize}`);
        this.renderer.setStyle(rightPane, 'flex', `0 0 ${storedRightPaneSize}`);
      } else {
        this.renderer.addClass(splitPane, 'both-visible');
        if (this.isColumnLayout) {
          this.renderer.setStyle(
            document.documentElement,
            '--top-pane-height',
            this.originalTopPaneSize
          );
          this.renderer.setStyle(
            document.documentElement,
            '--bottom-pane-height',
            this.originalBottomPaneSize
          );
          this.renderer.setStyle(
            leftPane,
            'flex',
            `0 0 ${this.originalTopPaneSize}`
          );
          this.renderer.setStyle(
            rightPane,
            'flex',
            `0 0 ${this.originalBottomPaneSize}`
          );
          localStorage.setItem('leftPaneSize', this.originalTopPaneSize);
          localStorage.setItem('rightPaneSize', this.originalBottomPaneSize);
        } else {
          this.renderer.setStyle(
            document.documentElement,
            '--left-pane-width',
            this.originalLeftPaneSize
          );
          this.renderer.setStyle(
            document.documentElement,
            '--right-pane-width',
            this.originalRightPaneSize
          );
          this.renderer.setStyle(
            leftPane,
            'flex',
            `0 0 ${this.originalLeftPaneSize}`
          );
          this.renderer.setStyle(
            rightPane,
            'flex',
            `0 0 ${this.originalRightPaneSize}`
          );
          localStorage.setItem('leftPaneSize', this.originalLeftPaneSize);
          localStorage.setItem('rightPaneSize', this.originalRightPaneSize);
        }
      }
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent) {
    if (this.isDragging) {
      this.endDragging();
    }
  }

  @HostListener('document:touchend', ['$event'])
  onDocumentTouchEnd(event: TouchEvent) {
    if (this.isDragging) {
      this.endDragging();
    }
  }

  generateVisualization() {
    // 1) all parameters for generate endpoint
    if (
      this.storyId != null &&
      this.selectedModel &&
      this.selectedLanguage &&
      this.selectedLibrary
    ) {
      this.isGenerating = true;
      this.shouldDisplayVisualization = true;

      // 2) payload including storyId
      const payload = {
        id: this.storyId,
        model: this.selectedModel,
        language: this.selectedLanguage.toLowerCase(),
        library: this.selectedLibrary,
        isDVL: this.isDVL,
      };
      console.log('generateVisualization() payload:', payload);
      console.log('Selected Language:', this.selectedLanguage);
      console.log('ACE Mode:', this.selectedLanguage.toLowerCase());
      // 3) Call backend
      this.visualizeService.generateVisulization(payload).subscribe(
        (response) => {
          // 4) On success: render chart & code
          const fullPath = response.output_path;
          // this.generatedFilename =
          //   fullPath.split('/').pop()?.replace('.html', '') || 'test';
          this.generatedFilename = fullPath.split('/').pop() || 'test.html';

          this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
            `http://localhost:8000${fullPath}`
          );
          // this.codeText = response.code;
          this.codeText = this.formatCodeIfNeeded(
            response.code,
            this.selectedLanguage
          );

          if (!localStorage.getItem('originalCode')) {
            localStorage.setItem('originalCode', this.codeText);
          }

          setTimeout(() => {
            this.isGenerating = false;
          }, 300);
        },
        (error) => {
          this.isGenerating = false;
          // this.codeText = 'Error while generating the visualization';
          // this.codeText = JSON.stringify(error.error.detail, null, 2);
          const detail = error.error.detail;
          this.codeText = `Something went wrong while generating your visualization\nWhat happened: ${
            detail.error_message
          }\nTechnical details:${
            detail.details?.stderr || 'No additional details available'
          }  `;
          this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
            '/assets/error-genviz.png'
          );
          this.generatedFilename = 'error-genviz.png';
        }
      );
    } else {
      this.shouldDisplayVisualization = false;
      this.visualSrc = '';
      this.isGenerating = false;
      console.warn(
        'generateVisualization() skipped: missing storyId or selection'
      );
    }
  }

  formatCodeIfNeeded(code: string, language: string): string {
    if (!code) return '';

    switch (language.toLowerCase()) {
      case 'javascript':
        return this.formatJavaScript(code);

      case 'r':
        return this.formatRCode(code);

      case 'python':
      default:
        return code;
    }
  }

  formatJavaScript(code: string): string {
    return code
      .replace(/;/g, ';\n')
      .replace(/{/g, '{\n    ')
      .replace(/}/g, '\n}')
      .replace(/,(?![^{]*})/g, ',\n    ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  formatRCode(code: string): string {
    return code
      .replace(/<-/g, ' <- ')
      .replace(/\+(?![^()]*\))/g, ' + ')
      .replace(/=/g, ' = ')
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
  }

  startDragging(event: MouseEvent) {
    this.removeAllEventListeners();

    event.preventDefault();
    this.isDragging = true;
    this.isMouseDown = true;
    this.showDragOverlay = true;

    this.dragBar = event.target as HTMLElement;
    this.renderer.addClass(this.dragBar, 'dragging');

    this.renderer.setStyle(document.body, 'user-select', 'none');

    const visualFrame = this.el.nativeElement.querySelector('.visual-frame');
    if (visualFrame) {
      this.renderer.setStyle(visualFrame, 'pointer-events', 'none');
    }

    const wrapper = this.el.nativeElement.querySelector('.visualize-wrapper');
    const leftPane = this.el.nativeElement.querySelector('.left-pane');
    const rightPane = this.el.nativeElement.querySelector('.right-pane');

    this.initialX = event.clientX;
    this.initialY = event.clientY;

    if (this.isColumnLayout) {
      this.initialTopHeight = leftPane.getBoundingClientRect().height;
      this.totalHeight = wrapper.clientHeight;

      console.log('Starting vertical drag in column layout', {
        initialTopHeight: this.initialTopHeight,
        totalHeight: this.totalHeight,
        initialY: this.initialY,
      });
    } else {
      this.initialLeftWidth = leftPane.getBoundingClientRect().width;
      this.totalWidth = wrapper.clientWidth;
    }

    this.ngZone.run(() => {
      const onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging || !this.isMouseDown) return;

        if (this.isColumnLayout) {
          const deltaY = e.clientY - this.initialY;

          let newTopHeightPercent =
            ((this.initialTopHeight + deltaY) / this.totalHeight) * 100;

          newTopHeightPercent = Math.max(20, Math.min(80, newTopHeightPercent));

          this.originalTopPaneSize = `${newTopHeightPercent}%`;
          this.originalBottomPaneSize = `${100 - newTopHeightPercent}%`;

          this.renderer.setStyle(
            document.documentElement,
            '--top-pane-height',
            this.originalTopPaneSize
          );
          this.renderer.setStyle(
            document.documentElement,
            '--bottom-pane-height',
            this.originalBottomPaneSize
          );

          this.renderer.setStyle(
            leftPane,
            'flex',
            `0 0 ${this.originalTopPaneSize}`
          );
          this.renderer.setStyle(
            rightPane,
            'flex',
            `0 0 ${this.originalBottomPaneSize}`
          );

          console.log('Vertical dragging', {
            deltaY,
            newTopHeightPercent,
            topPaneSize: this.originalTopPaneSize,
            bottomPaneSize: this.originalBottomPaneSize,
          });
        } else {
          const deltaX = e.clientX - this.initialX;

          let newLeftWidthPercent =
            ((this.initialLeftWidth + deltaX) / this.totalWidth) * 100;

          newLeftWidthPercent = Math.max(20, Math.min(80, newLeftWidthPercent));

          this.originalLeftPaneSize = `${newLeftWidthPercent}%`;
          this.originalRightPaneSize = `${100 - newLeftWidthPercent}%`;

          this.renderer.setStyle(
            document.documentElement,
            '--left-pane-width',
            this.originalLeftPaneSize
          );
          this.renderer.setStyle(
            document.documentElement,
            '--right-pane-width',
            this.originalRightPaneSize
          );

          this.renderer.setStyle(
            leftPane,
            'flex',
            `0 0 ${this.originalLeftPaneSize}`
          );
          this.renderer.setStyle(
            rightPane,
            'flex',
            `0 0 ${this.originalRightPaneSize}`
          );
        }
      };

      this.mouseMoveListener = this.renderer.listen(
        'document',
        'mousemove',
        onMouseMove
      );
      this.mouseUpListener = this.renderer.listen('document', 'mouseup', () =>
        this.endDragging()
      );
    });
  }

  startTouchDragging(event: TouchEvent) {
    this.removeAllEventListeners();

    event.preventDefault();
    this.isDragging = true;
    this.showDragOverlay = true;

    this.dragBar = event.target as HTMLElement;
    this.renderer.addClass(this.dragBar, 'dragging');

    this.renderer.setStyle(document.body, 'user-select', 'none');

    const visualFrame = this.el.nativeElement.querySelector('.visual-frame');
    if (visualFrame) {
      this.renderer.setStyle(visualFrame, 'pointer-events', 'none');
    }

    const wrapper = this.el.nativeElement.querySelector('.visualize-wrapper');
    const leftPane = this.el.nativeElement.querySelector('.left-pane');
    const rightPane = this.el.nativeElement.querySelector('.right-pane');

    this.initialX = event.touches[0].clientX;
    this.initialY = event.touches[0].clientY;

    if (this.isColumnLayout) {
      this.initialTopHeight = leftPane.getBoundingClientRect().height;
      this.totalHeight = wrapper.clientHeight;

      console.log('Starting touch vertical drag in column layout', {
        initialTopHeight: this.initialTopHeight,
        totalHeight: this.totalHeight,
        initialY: this.initialY,
      });
    } else {
      this.initialLeftWidth = leftPane.getBoundingClientRect().width;
      this.totalWidth = wrapper.clientWidth;
    }

    this.ngZone.run(() => {
      const onTouchMove = (e: TouchEvent) => {
        if (!this.isDragging) return;

        if (this.isColumnLayout) {
          const deltaY = e.touches[0].clientY - this.initialY;

          let newTopHeightPercent =
            ((this.initialTopHeight + deltaY) / this.totalHeight) * 100;

          newTopHeightPercent = Math.max(20, Math.min(80, newTopHeightPercent));

          this.originalTopPaneSize = `${newTopHeightPercent}%`;
          this.originalBottomPaneSize = `${100 - newTopHeightPercent}%`;

          this.renderer.setStyle(
            document.documentElement,
            '--top-pane-height',
            this.originalTopPaneSize
          );
          this.renderer.setStyle(
            document.documentElement,
            '--bottom-pane-height',
            this.originalBottomPaneSize
          );

          this.renderer.setStyle(
            leftPane,
            'flex',
            `0 0 ${this.originalTopPaneSize}`
          );
          this.renderer.setStyle(
            rightPane,
            'flex',
            `0 0 ${this.originalBottomPaneSize}`
          );

          console.log('Touch vertical dragging', {
            deltaY,
            newTopHeightPercent,
            topPaneSize: this.originalTopPaneSize,
            bottomPaneSize: this.originalBottomPaneSize,
          });
        } else {
          const deltaX = e.touches[0].clientX - this.initialX;

          let newLeftWidthPercent =
            ((this.initialLeftWidth + deltaX) / this.totalWidth) * 100;

          newLeftWidthPercent = Math.max(20, Math.min(80, newLeftWidthPercent));

          this.originalLeftPaneSize = `${newLeftWidthPercent}%`;
          this.originalRightPaneSize = `${100 - newLeftWidthPercent}%`;

          this.renderer.setStyle(
            document.documentElement,
            '--left-pane-width',
            this.originalLeftPaneSize
          );
          this.renderer.setStyle(
            document.documentElement,
            '--right-pane-width',
            this.originalRightPaneSize
          );

          this.renderer.setStyle(
            leftPane,
            'flex',
            `0 0 ${this.originalLeftPaneSize}`
          );
          this.renderer.setStyle(
            rightPane,
            'flex',
            `0 0 ${this.originalRightPaneSize}`
          );
        }
      };

      this.touchMoveListener = this.renderer.listen(
        'document',
        'touchmove',
        onTouchMove
      );
      this.touchEndListener = this.renderer.listen('document', 'touchend', () =>
        this.endDragging()
      );
    });
  }

  endDragging() {
    this.isDragging = false;
    this.isMouseDown = false;
    this.showDragOverlay = false;

    if (this.dragBar) {
      this.renderer.removeClass(this.dragBar, 'dragging');
      this.dragBar = null;
    }

    this.renderer.removeStyle(document.body, 'user-select');

    const visualFrame = this.el.nativeElement.querySelector('.visual-frame');
    if (visualFrame) {
      this.renderer.setStyle(visualFrame, 'pointer-events', 'auto');
    }

    this.removeAllEventListeners();
  }

  private removeAllEventListeners() {
    if (this.mouseMoveListener) {
      this.mouseMoveListener();
      this.mouseMoveListener = null;
    }

    if (this.mouseUpListener) {
      this.mouseUpListener();
      this.mouseUpListener = null;
    }

    if (this.touchMoveListener) {
      this.touchMoveListener();
      this.touchMoveListener = null;
    }

    if (this.touchEndListener) {
      this.touchEndListener();
      this.touchEndListener = null;
    }
  }

  private ensureProperSizing() {
    const visualizationContainer = this.el.nativeElement.querySelector(
      '.visualization-container'
    );
    if (visualizationContainer) {
      this.renderer.setStyle(visualizationContainer, 'height', '100%');
    }

    const iframeWrapper =
      this.el.nativeElement.querySelector('.iframe-wrapper');
    if (iframeWrapper) {
      this.renderer.addClass(iframeWrapper, 'scrollable');
    }
  }

  private enhanceDropdowns() {
    const dropdowns = this.el.nativeElement.querySelectorAll('.dropdown');
    dropdowns.forEach((dropdown: HTMLElement) => {
      this.renderer.listen(dropdown, 'change', () => {
        this.animateDropdownChange();
      });
    });
  }

  animateDropdownChange() {
    const dropdowns = this.el.nativeElement.querySelectorAll('.dropdown');
    dropdowns.forEach((dropdown: HTMLElement) => {
      this.renderer.addClass(dropdown, 'changed');
      setTimeout(() => {
        this.renderer.removeClass(dropdown, 'changed');
      }, 300);
    });
  }
  applyRefinement(): void {
    const text = this.refineText.trim();
    if (!text) {
      return;
    }
    this.history.push({
      userText: this.refineText.trim(),
      code: '',
      time: new Date(),
      isDone: false,
      collapsed: true,
      model: this.selectedModel,
    });
    this.refineText = '';
    const currentItem = this.history[this.history.length - 1];
    this.isGenerating = true;
    currentItem.isDone = false;

    this.appService.refineVisualization(text).subscribe(
      (res: RefineResponse) => {
        this.codeText = res.updated_code;
        currentItem.code = res.thinking_text;
        currentItem.isDone = true;
        this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
          `http://localhost:8000${res.output_path}`
        );
        this.isGenerating = false;
      },
      (err) => {
        const errorDetails =
          err?.error?.detail || err?.message || 'Unknown error';
        const errorCode = err?.error?.error_code || 'HTTP_ERROR';

        currentItem.code = `Refinement Failed\nError: ${errorDetails}, Error Code: ${errorCode}`;
        currentItem.isDone = true;

        this.codeText = `Refinement Request Failed\nDetails: ${errorDetails}`;
        this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
          '/assets/error-genviz.png'
        );
        this.generatedFilename = 'error-genviz.png';
        // console.error('Refinement request failed:', err);
        this.isGenerating = false;
        this.isGenerating = false;
      }
    );
  }

  // UNDO
  undoVisualization(): void {
    // Prevent multiple simultaneous undo requests
    if (this.isUndoing) {
      return;
    }
    this.isUndoing = true;
    this.visualizeService
      .undoVisualization()
      .subscribe(
        (response) => {
          if (response.status === 'success') {
            // Update the code editor with the reverted code
            this.codeText = response.updated_code;

            // Update the visualization with the new output
            this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
              `http://localhost:8000${response.output_path}`
            );

            // Update the generated filename for downloads
            const fullPath = response.output_path;
            this.generatedFilename =
              fullPath.split('/').pop()?.replace('.html', '') || 'test';
            // this.generatedFilename = fullPath.split('/').pop() || 'test.html';

            // console.log('Undo successful:', response.message);
            // this.showMessage('Changes undone successfully');
          } else {
            // display error message in code pane
            this.codeText = ` Undo Failed\nError: ${response.error_message}, Error Code: ${response.error_code}`;
            //  error image in visualization pane
            this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
              '/assets/error-genviz.png'
            );
            this.generatedFilename = 'error-genviz.png';

            console.error('Undo failed:', response.error_message);
          }
        },
        (error) => {
          // Handle HTTP error
          this.codeText = `Undo Request Failed\nUnexpected error occurred.\nDetails: ${
            error?.message || 'Unknown error'
          }`;
          this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
            '/assets/error-genviz.png'
          );
          this.generatedFilename = 'error-genviz.png';
          console.error('Undo request failed:', error);
        }
      )
      .add(() => {
        this.isUndoing = false;
      });
  }
  copiedMessageShown = false;

  copyCode() {
    if (!this.codeText) return;

    navigator.clipboard.writeText(this.codeText).then(
      () => {
        this.copiedMessageShown = true;
        setTimeout(() => {
          this.copiedMessageShown = false;
        }, 2000);
      },
      (err) => {
        console.error('Failed to copy code:', err);
      }
    );
  }

  revertCode() {
    const originalCode = localStorage.getItem('originalCode');
    if (originalCode) {
      this.codeText = originalCode;
      this.isCodeModified = false;
      console.log('Code reverted to original.');
    } else {
      console.warn('Original code not found.');
    }
  }
  downloadVisualization() {
    if (!this.generatedFilename) {
      console.warn('No file to download.');
      return;
    }

    console.log('generatedFilename:', this.generatedFilename); // Debug log
    console.log('visualSrc:', this.visualSrc);
    let fullFilename = this.generatedFilename;

    // If the generatedFilename doesn't already include extension, determine it
    // if (!fullFilename.includes('.')) {
    //   const isPng = this.visualSrc?.toString().endsWith('.png');
    //   fullFilename = isPng
    //     ? `${this.generatedFilename}.png`
    //     : `${this.generatedFilename}.html`;
    // }
    // console.log('fullFilename being sent:', fullFilename);
    if (!/\.(html|png)$/i.test(fullFilename)) {
      const src = this.visualSrc?.toString().toLowerCase() || '';
      fullFilename += src.endsWith('.png') ? '.png' : '.html';
    }
    this.visualizeService.downloadVisualization(fullFilename).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fullFilename;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Download failed:', error);
      },
    });
  }

  insertText(text: string, event: MouseEvent) {
    this.refineText = text;
    const target = event.target as HTMLElement;
    const snackbar = target.closest('.snackbar');
    if (snackbar) {
      snackbar.classList.add('clicked');
      setTimeout(() => {
        snackbar.classList.remove('clicked');
      }, 1500);
    }
  }

  clearText() {
    this.refineText = '';
  }
}
