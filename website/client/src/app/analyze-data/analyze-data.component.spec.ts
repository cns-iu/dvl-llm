import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalyzeDataComponent } from './analyze-data.component';

describe('AnalyzeDataComponent', () => {
  let component: AnalyzeDataComponent;
  let fixture: ComponentFixture<AnalyzeDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyzeDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalyzeDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
