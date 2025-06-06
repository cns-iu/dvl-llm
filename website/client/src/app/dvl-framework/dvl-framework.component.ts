import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  Renderer2,
  NgZone,
  HostListener,
  OnInit,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';

import { FormsModule } from '@angular/forms';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-dvl-framework',
  imports: [CommonModule, FormsModule, AceEditorModule, HttpClientModule],
  templateUrl: './dvl-framework.component.html',
  styleUrl: './dvl-framework.component.css',
})
export class DvlFrameworkComponent implements AfterViewInit {
  models = ['Deepseek - R1', 'llama-4-scout'];
  selectedModel = this.models[0];

  languages = ['Python', 'R', 'JavaScript'];
  selectedLanguage = 'Python';
  originalCodeText: string = '';
  isCodeModified: boolean = false;

  isGenerating: boolean = false;

  isDVL: boolean = false;

  // Carousel navigation state
  isAtStart: boolean = true;
  isAtEnd: boolean = false;

  libraries = [
    {
      name: 'altair',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/sample_test_altair.html',
      type: 'interactive',
    },
    {
      name: 'plotly',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/html_plotly_us1.html',
      type: 'interactive',
    },
    {
      name: 'pygal',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/html_pygal_us1.html',
      type: 'interactive',
    },
    {
      name: 'seaborn',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/png_seaborn_us1.png',
      type: 'non-interactive',
    },
    {
      name: 'bokeh',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/html_bokeh_us1.html',
      type: 'interactive',
    },
    {
      name: 'plotnine',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/html_plotnine_us1.html',
      type: 'non-interactive',
    },
    {
      name: 'chartify',
      language: 'Python',
      code: `import altair as alt\nimport pandas as pd\n\ndata = pd.DataFrame({\n  'x': ['A', 'B', 'C', 'D'],\n  'y': [5, 3, 6, 7]\n})\nchart = alt.Chart(data).mark_bar().encode(x='x', y='y')\nchart.show()`,
      jsonPath: '/html_chartify_us1.html',
      type: 'interactive',
    },
    {
      name: 'ggplot2',
      language: 'R',
      code: `library(ggplot2)\ndata <- data.frame(x = c("A", "B", "C", "D"), y = c(5, 3, 6, 7))\nggplot(data, aes(x=x, y=y)) + geom_bar(stat="identity")`,
      jsonPath: '/cumulative_counts_log.html',
      type: 'static',
    },
    {
      name: 'googlecharts',
      language: 'JavaScript',
      code: `google.charts.load("current", { packages: ["corechart"] });
google.charts.setOnLoadCallback(() => {
  const data = google.visualization.arrayToDataTable([
    ["x", "y"],
    ["A", 5],
    ["B", 3],
    ["C", 6],
    ["D", 7]
  ]);
  new google.visualization.ColumnChart(document.getElementById("chart_div"))
    .draw(data, { legend: "none" });
});
`,
      jsonPath: '/us1_js_1.html',
      type: 'static',
    },
  ];

  filteredLibraries = this.libraries.filter(
    (lib) => lib.language === this.selectedLanguage
  );

  selectedLibrary = this.filteredLibraries[0].name;
  codeText: string = '';
  visualSrc: SafeResourceUrl = '';
  isDragging = false;

  isMouseDown = false;

  showDragOverlay = false;

  refineText: string = '';

  isVisualizationVisible = true;
  isCodeVisible = true;

  shouldDisplayVisualization = false;

  private originalLeftPaneSize = '60%';
  private originalRightPaneSize = '40%';
  private originalTopPaneSize = '60%';
  private originalBottomPaneSize = '40%';

  private isColumnLayout = false;

  private wasCodeVisible = true;

  @ViewChild('leftPane') leftPane!: ElementRef;
  @ViewChild('rightPane') rightPane!: ElementRef;
  @ViewChild('splitPane') splitPane!: ElementRef;
  @ViewChild('carouselTrack') carouselTrack!: ElementRef;
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

  constructor(
    private sanitizer: DomSanitizer,
    private renderer: Renderer2,
    private el: ElementRef,
    private ngZone: NgZone,
    private http: HttpClient
  ) {
    this.codeText = '';
  }

  getVisualizationTypeIcon(type: string): string {
    switch (type) {
      case 'interactive':
        return 'fas fa-hand-pointer';
      case 'non-interactive':
        return 'fas fa-chart-bar';
      case '3d':
        return 'fas fa-cube';
      default:
        return 'fas fa-question-circle';
    }
  }

  getVisualizationTypeTooltip(type: string): string {
    switch (type) {
      case 'interactive':
        return 'Interactive Visualization';
      case 'non-interactive':
        return 'Static Visualization';
      case '3d':
        return '3D Visualization';
      default:
        return 'Unknown Type';
    }
  }

  getSelectedLibraryType(): string {
    const selectedLib = this.libraries.find(
      (lib) => lib.name === this.selectedLibrary
    );
    return selectedLib ? selectedLib.type : '';
  }

  ngAfterViewInit() {
    this.ensureProperSizing();
    this.checkLayoutMode();
    this.checkCarouselNavigation();

    window.addEventListener('resize', () => {
      this.ensureProperSizing();
      this.checkLayoutMode();
      this.checkCarouselNavigation();
    });

    const dragBar = this.el.nativeElement.querySelector('.drag-bar-vertical');
    if (dragBar) {
      this.renderer.listen(dragBar, 'touchstart', (e: TouchEvent) => {
        this.startTouchDragging(e);
      });
    }

    this.setInitialPaneSizes();

    setTimeout(() => {
      this.updateLayoutBasedOnVisibility();
    }, 100);
  }

  ngOnDestroy() {
    this.removeAllEventListeners();

    window.removeEventListener('resize', () => {
      this.ensureProperSizing();
      this.checkLayoutMode();
      this.checkCarouselNavigation();
    });
  }

  // Carousel navigation methods
  scrollCarousel(direction: 'left' | 'right') {
    if (!this.carouselTrack) return;

    const track = this.carouselTrack.nativeElement;
    const cardWidth = 200; // Card width + margin
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;

    track.scrollBy({
      left: scrollAmount,
      behavior: 'smooth',
    });

    // Check navigation state after scrolling
    setTimeout(() => {
      this.checkCarouselNavigation();
    }, 300);
  }

  checkCarouselNavigation() {
    if (!this.carouselTrack) return;

    const track = this.carouselTrack.nativeElement;
    this.isAtStart = track.scrollLeft <= 10;
    this.isAtEnd =
      track.scrollLeft + track.clientWidth >= track.scrollWidth - 10;
  }

  // Scroll to the selected card to make it visible
  scrollToSelectedCard() {
    if (!this.carouselTrack) return;

    const track = this.carouselTrack.nativeElement;
    const selectedCard = track.querySelector('.viz-card.selected');

    if (selectedCard) {
      const cardLeft = selectedCard.offsetLeft;
      const cardWidth = selectedCard.offsetWidth;
      const trackWidth = track.clientWidth;
      const scrollLeft = track.scrollLeft;

      // If card is not fully visible, scroll to make it centered
      if (
        cardLeft < scrollLeft ||
        cardLeft + cardWidth > scrollLeft + trackWidth
      ) {
        track.scrollTo({
          left: cardLeft - trackWidth / 2 + cardWidth / 2,
          behavior: 'smooth',
        });
      }
    }
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
    if (!this.isCodeVisible) {
      this.isCodeVisible = true;

      const splitPane = this.el.nativeElement.querySelector('.split-pane');
      if (splitPane) {
        this.renderer.addClass(splitPane, 'transitioning');

        setTimeout(() => {
          this.renderer.removeClass(splitPane, 'transitioning');
        }, 500);
      }
    } else {
      this.wasCodeVisible = true;
      this.isCodeVisible = false;

      const splitPane = this.el.nativeElement.querySelector('.split-pane');
      if (splitPane) {
        this.renderer.addClass(splitPane, 'transitioning');

        setTimeout(() => {
          this.renderer.removeClass(splitPane, 'transitioning');
        }, 500);
      }
    }

    if (!this.isVisualizationVisible && !this.isCodeVisible) {
      this.isVisualizationVisible = true;
    }

    setTimeout(() => {
      this.updateLayoutBasedOnVisibility();
    }, 10);
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
      this.renderer.removeClass(leftPane, 'hidden');
      this.renderer.addClass(rightPane, 'hidden');
      this.renderer.addClass(leftPane, 'fullscreen');
      this.renderer.removeClass(rightPane, 'fullscreen');

      this.renderer.setStyle(leftPane, 'flex', '1 1 auto');
      this.renderer.setStyle(leftPane, 'width', '100%');
      this.renderer.setStyle(leftPane, 'height', '100%');
      this.renderer.setStyle(leftPane, 'max-width', '100%');
      this.renderer.setStyle(leftPane, 'max-height', '100%');

      const iframe = leftPane.querySelector('iframe');
      if (iframe) {
        this.renderer.setStyle(iframe, 'width', '100%');
        this.renderer.setStyle(iframe, 'height', '100%');
      }
    } else if (!this.isVisualizationVisible && this.isCodeVisible) {
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
    }
  }

  private setInitialPaneSizes() {
    const splitPane = this.el.nativeElement.querySelector('.split-pane');
    const leftPane = this.el.nativeElement.querySelector('.left-pane');
    const rightPane = this.el.nativeElement.querySelector('.right-pane');

    if (splitPane && leftPane && rightPane) {
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

  // Modified to use static data from the libraries array
  generateVisualization() {
    if (this.selectedModel && this.selectedLanguage && this.selectedLibrary) {
      this.isGenerating = true;
      this.shouldDisplayVisualization = true;

      // Find the selected library from the static data
      const selected = this.libraries.find(
        (lib) => lib.name === this.selectedLibrary
      );

      if (selected) {
        this.refineText = '';

        // Use the static data from the selected library
        setTimeout(() => {
          // Create a response object similar to what the API would return
          const response = {
            url: selected.jsonPath,
            code: selected.code,
          };

          // Set the visualization source
          this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
            response.url
          );

          // Set the code text
          this.codeText = response.code;

          // Store the original code in localStorage
          const key = 'originalCode';
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, response.code);
          }

          // Apply styling to the visualization container
          setTimeout(() => {
            const wrapper =
              this.el.nativeElement.querySelector('.iframe-wrapper');
            if (wrapper) {
              this.renderer.addClass(wrapper, 'scrollable');
            }

            const isPng = response.url.endsWith('.png');

            if (isPng && this.visualImage) {
              const img = this.visualImage.nativeElement;
              this.renderer.setStyle(img, 'width', '100%');
              this.renderer.setStyle(img, 'height', '100%');
              this.renderer.setStyle(img, 'object-fit', 'contain');
              this.renderer.setStyle(img, 'max-width', '100%');
              this.renderer.setStyle(img, 'max-height', '100%');
              this.renderer.setStyle(img, 'display', 'block');
            } else if (
              !isPng &&
              this.visualFrame &&
              this.visualFrame.nativeElement
            ) {
              const iframe = this.visualFrame.nativeElement;
              this.renderer.setStyle(iframe, 'width', '100%');
              this.renderer.setStyle(iframe, 'height', '100%');
              this.renderer.setStyle(iframe, 'border', 'none');
            }

            this.isGenerating = false;
          }, 300);
        }, 500); // Simulate API delay
      }
    } else {
      this.shouldDisplayVisualization = false;
      this.visualSrc = '';
      this.isGenerating = false;
    }
  }

  selectLanguage(lang: string) {
    this.selectedLanguage = lang;
    this.filteredLibraries = this.libraries.filter(
      (lib) => lib.language === lang
    );
    if (this.filteredLibraries.length > 0) {
      this.selectLibrary(this.filteredLibraries[0].name);
    }

    this.animateDropdownChange();

    // Check carousel navigation after filtering
    setTimeout(() => {
      this.checkCarouselNavigation();
    }, 100);
  }

  selectLibrary(libName: string) {
    this.selectedLibrary = libName;
    this.animateDropdownChange();

    // Scroll to make the selected card visible
    setTimeout(() => {
      this.scrollToSelectedCard();
    }, 100);
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

  animateDropdownChange() {
    const dropdowns = this.el.nativeElement.querySelectorAll('.dropdown');
    dropdowns.forEach((dropdown: HTMLElement) => {
      this.renderer.addClass(dropdown, 'changed');
      setTimeout(() => {
        this.renderer.removeClass(dropdown, 'changed');
      }, 300);
    });
  }

  // Modified to use static data
  applyRefinement() {
    if (!this.refineText.trim()) return;

    this.isGenerating = true;

    // Find the selected library from the static data
    const selected = this.libraries.find(
      (lib) => lib.name === this.selectedLibrary
    );

    if (selected) {
      // Simulate API delay
      setTimeout(() => {
        // Just reuse the same visualization path since we're using static data
        this.visualSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
          selected.jsonPath
        );
        this.isGenerating = false;
      }, 500);
    } else {
      this.isGenerating = false;
    }
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
    if (!this.visualSrc) return;

    const url = this.visualSrc.toString();
    const fileName = url.split('/').pop() || 'visualization';

    this.http.get(url, { responseType: 'blob' }).subscribe(
      (blob) => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(a.href);
      },
      (error) => {
        console.error('Download failed:', error);
      }
    );
  }
}
