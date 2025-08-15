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
    private appService: AppService // ← user story
  ) {
    this.codeText = '';
  }

  ngOnInit() {
    // 1) Debug: print any router navigation object (usually null on reload)
    console.log(
      'Inside ngOnInit  router.getCurrentNavigation():',
      this.router.getCurrentNavigation()
    );

    // 2) Grab whatever you passed via router.navigate(..., { state })
    const state = history.state as {
      id: number;
      model: string;
      language: string;
      library: string;
      isDVL: boolean;
    };
    console.log('📦 history.state in VisualizeComponent:', state);

    // 3) If valid, initialize and fire off the generation
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
      // 5) Log and generate
      console.log('generateVisualization() calling');
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

  // toggleCode() {
  //   if (!this.isCodeVisible) {
  //     this.isCodeVisible = true;
  //     this.isVisualizationVisible = false;
  //     const splitPane = this.el.nativeElement.querySelector('.split-pane');
  //     if (splitPane) {
  //       this.renderer.addClass(splitPane, 'transitioning');
  //       setTimeout(() => {
  //         this.renderer.removeClass(splitPane, 'transitioning');
  //       }, 500);
  //     }
  //   } else {
  //     this.isCodeVisible = false;
  //     const splitPane = this.el.nativeElement.querySelector('.split-pane');
  //     if (splitPane) {
  //       this.renderer.addClass(splitPane, 'transitioning');
  //       setTimeout(() => {
  //         this.renderer.removeClass(splitPane, 'transitioning');
  //       }, 500);
  //     }
  //   }
  //   setTimeout(() => {
  //     this.updateLayoutBasedOnVisibility();
  //   }, 10);
  // }
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
      // this.renderer.removeClass(splitPane, 'both-visible');
      // this.renderer.addClass(splitPane, 'single-pane');
      // this.renderer.removeClass(leftPane, 'hidden');
      // this.renderer.addClass(leftPane, 'hidden');
      // this.renderer.addClass(leftPane, 'fullscreen');
      // this.renderer.removeClass(rightPane, 'fullscreen');

      // this.renderer.setStyle(leftPane, 'flex', '1 1 auto');
      // this.renderer.setStyle(leftPane, 'width', '100%');
      // this.renderer.setStyle(leftPane, 'height', '100%');
      // this.renderer.setStyle(leftPane, 'max-width', '100%');
      // this.renderer.setStyle(leftPane, 'max-height', '100%');
      //
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
      //
      const iframe = leftPane.querySelector('iframe');
      if (iframe) {
        this.renderer.setStyle(iframe, 'width', '100%');
        this.renderer.setStyle(iframe, 'height', '100%');
      }
    }
    // else if (!this.isVisualizationVisible && this.isCodeVisible) {
    //   this.renderer.removeClass(splitPane, 'both-visible');
    //   this.renderer.addClass(splitPane, 'single-pane');
    //   this.renderer.addClass(leftPane, 'hidden');
    //   this.renderer.removeClass(rightPane, 'hidden');
    //   this.renderer.removeClass(leftPane, 'fullscreen');
    //   this.renderer.addClass(rightPane, 'fullscreen');

    //   this.renderer.setStyle(rightPane, 'flex', '1 1 auto');
    //   this.renderer.setStyle(rightPane, 'width', '100%');
    //   this.renderer.setStyle(rightPane, 'height', '100%');
    //   this.renderer.setStyle(rightPane, 'max-width', '100%');
    //   this.renderer.setStyle(rightPane, 'max-height', '100%');
    // }
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
    // 1) Ensure we have everything we need
    if (
      this.storyId != null &&
      this.selectedModel &&
      this.selectedLanguage &&
      this.selectedLibrary
    ) {
      this.isGenerating = true;
      this.shouldDisplayVisualization = true;

      // 2) Build payload including storyId
      const payload = {
        id: this.storyId,
        model: this.selectedModel,
        language: this.selectedLanguage.toLowerCase(),
        library: this.selectedLibrary,
        isDVL: this.isDVL,
      };
      console.log('generateVisualization() payload:', payload);

      // 3) Call backend
      this.visualizeService
        .generateVisulization(payload) // ensure your service method is named generateVisualization
        .subscribe(
          (response) => {
            // 4) On success: render chart & code
            const fullPath = response.output_path;
            this.generatedFilename =
              fullPath.split('/').pop()?.replace('.html', '') || 'test';

            this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
              `http://localhost:8000${fullPath}`
            );
            this.codeText = response.code;

            // 5) Save original code if first time
            if (!localStorage.getItem('originalCode')) {
              localStorage.setItem('originalCode', this.codeText);
            }

            // 6) Tweak DOM after a short delay (same as your existing logic)
            setTimeout(() => {
              // ... your existing resizing/scrolling logic ...
              this.isGenerating = false;
            }, 300);
          },
          (error) => {
            console.error('❌ Error generating visualization:', error);
            this.isGenerating = false;
          }
        );
    } else {
      // Missing required info: hide everything
      this.shouldDisplayVisualization = false;
      this.visualSrc = '';
      this.isGenerating = false;
      console.warn(
        'generateVisualization() skipped: missing storyId or selection'
      );
    }
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
        // currentItem.code = res.updated_code;
        //         currentItem.code = `We are going to change the y-axis to a log scale as requested.
        // The previous code already uses a linear scale, so we will adjust the layout to set the y-axis to log.
        // We'll update the update_layout method to set yaxis_type='log'.
        // Also, note that using a log scale might require handling zero counts. However, our cumulative counts start at 1 and grow, so it should be safe.
        // If there are zeros in cumulative counts, we might need to adjust (but in the provided data, the counts are positive). We'll proceed with the log scale.
        // However, let's note: the cumulative counts are computed from the 'count' values. Since the initial counts are positive (minimum 1), the cumulative counts will be at least 1. So no problem.
        // We'll change the update_layout for yaxis_type from 'linear' to 'log'.
        // Also, we can adjust the title and axis labels accordingly.
        // But note: the requirement is to change to log scale on y-axis.
        // Let's update the code accordingly.
        // `;
        currentItem.code = res.thinking_text;
        currentItem.isDone = true;
        this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
          `http://localhost:8000${res.output_path}`
        );
        this.isGenerating = false;
      },
      (err) => {
        console.error(err);
        this.isGenerating = false;
      }
    );
  }

  // UNDO
  undoVisualization(): void {
    if (this.isUndoing) {
      return; // Prevent multiple simultaneous undo requests
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

            // Show success message (optional)
            console.log('Undo successful:', response.message);

            // You could also show a toast/snackbar message here
            // this.showMessage('Changes undone successfully');
          } else {
            // Handle error response
            console.error('Undo failed:', response.error_message);
            // this.handleUndoError(response);
          }
        },
        (error) => {
          // Handle HTTP error
          console.error('Undo request failed:', error);
          // this.handleUndoError(error);
        }
      )
      .add(() => {
        // This runs whether success or error
        this.isUndoing = false;
      });
  }
  // UNDO
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

    this.visualizeService
      .downloadVisualization(this.generatedFilename)
      .subscribe(
        (blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const htmlText = reader.result as string;
            const finalBlob = new Blob([htmlText], { type: 'text/html' });
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.generatedFilename}.html`;
            a.click();
            URL.revokeObjectURL(url);
          };
          reader.readAsText(blob);
        },
        (error) => {
          console.error('Download failed:', error);
        }
      );
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
