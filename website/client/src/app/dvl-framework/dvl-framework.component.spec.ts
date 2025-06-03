import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DvlFrameworkComponent } from './dvl-framework.component';

describe('DvlFrameworkComponent', () => {
  let component: DvlFrameworkComponent;
  let fixture: ComponentFixture<DvlFrameworkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DvlFrameworkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DvlFrameworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
